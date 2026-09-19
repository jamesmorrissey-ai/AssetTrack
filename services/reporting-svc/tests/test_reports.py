import json
from datetime import date, timedelta

import httpx
import pytest
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app, raise_server_exceptions=False)


def install_upstream(monkeypatch: pytest.MonkeyPatch, handler) -> None:
    real_async_client = httpx.AsyncClient
    transport = httpx.MockTransport(handler)
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **_: real_async_client(transport=transport),
    )


def test_warranty_expiring_returns_only_assets_within_threshold(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    today = date.today()  # noqa: DTZ011 - mirrors the production date calculation
    within_threshold = (today + timedelta(days=10)).isoformat()
    outside_threshold = (today + timedelta(days=31)).isoformat()

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/assets"
        return httpx.Response(
            200,
            json=[
                {
                    "assetTag": "DUE-SOON",
                    "model": "Alpha",
                    "warrantyExpiry": within_threshold,
                    "status": "available",
                },
                {
                    "assetTag": "DUE-LATER",
                    "model": "Beta",
                    "warrantyExpiry": outside_threshold,
                    "status": "assigned",
                },
                {
                    "assetTag": "NO-WARRANTY",
                    "model": "Gamma",
                    "warrantyExpiry": None,
                    "status": "available",
                },
            ],
        )

    install_upstream(monkeypatch, handler)

    response = client.get("/reports/warranty-expiring?within_days=30")

    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert response.json()["within_days"] == 30
    assert response.json()["items"][0]["assetTag"] == "DUE-SOON"
    assert response.json()["items"][0]["warrantyExpiry"] == within_threshold


def test_warranty_expiring_returns_empty_results(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_upstream(
        monkeypatch,
        lambda _: httpx.Response(
            200,
            json=[
                {
                    "assetTag": "NO-WARRANTY",
                    "model": "Alpha",
                    "warrantyExpiry": None,
                    "status": "available",
                }
            ],
        ),
    )

    response = client.get("/reports/warranty-expiring?within_days=30")

    assert response.status_code == 200
    assert response.json() == {"count": 0, "within_days": 30, "items": []}


def test_warranty_expiring_maps_assets_error_to_bad_gateway(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_upstream(
        monkeypatch,
        lambda request: httpx.Response(503, request=request),
    )

    response = client.get("/reports/warranty-expiring")

    assert response.status_code == 502
    assert "assets-svc unavailable" in response.json()["detail"]


@pytest.mark.parametrize(
    ("counts", "total", "in_use", "percentage"),
    [
        ({"available": 3, "assigned": 1}, 4, 1, 25.0),
        ({}, 0, 0, 0.0),
        ({"assigned": 4}, 4, 4, 100.0),
        ({"available": 4}, 4, 0, 0.0),
    ],
)
def test_utilization_calculates_assigned_vs_available(
    monkeypatch: pytest.MonkeyPatch,
    counts: dict[str, int],
    total: int,
    in_use: int,
    percentage: float,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/assets/stats/by-status"
        return httpx.Response(200, json=counts)

    install_upstream(monkeypatch, handler)

    response = client.get("/reports/utilization")

    assert response.status_code == 200
    assert response.json() == {
        "total": total,
        "in_use": in_use,
        "utilization_pct": percentage,
        "by_status": counts,
    }


def test_csv_import_posts_each_valid_row(monkeypatch: pytest.MonkeyPatch) -> None:
    posted: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/assets"
        posted.append(json.loads(request.content))
        return httpx.Response(201, json={"id": len(posted)})

    install_upstream(monkeypatch, handler)
    csv_body = (
        "asset_tag,asset_type,manufacturer,model,status,serial_number\n"
        "CSV-001,Laptop,Contoso,Alpha,available,SER-1\n"
        "CSV-002,Monitor,Fabrikam,Vision,assigned,\n"
    )

    response = client.post(
        "/imports/assets",
        files={"file": ("assets.csv", csv_body, "text/csv")},
    )

    assert response.status_code == 200
    assert response.json() == {
        "imported": 2,
        "asset_tags": ["CSV-001", "CSV-002"],
    }
    assert [row["assetTag"] for row in posted] == ["CSV-001", "CSV-002"]
    assert posted[1]["serialNumber"] is None


def test_csv_import_rejects_missing_required_columns() -> None:
    response = client.post(
        "/imports/assets",
        files={"file": ("assets.csv", "asset_tag,model\nCSV-001,Alpha\n", "text/csv")},
    )

    assert response.status_code == 400
    detail = response.json()["detail"]
    assert "CSV must contain columns" in detail
    assert "asset_type" in detail
    assert "status" in detail


@pytest.mark.xfail(
    strict=True,
    reason=(
        "Exercise #6 gap: one rejected row currently aborts the import instead "
        "of reporting it as skipped."
    ),
)
def test_csv_import_skips_bad_row_and_imports_valid_rows(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    posted_tags: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        if payload["assetTag"] == "CSV-BAD":
            return httpx.Response(400, request=request, json={"detail": "invalid row"})
        posted_tags.append(payload["assetTag"])
        return httpx.Response(201, request=request, json={"id": len(posted_tags)})

    install_upstream(monkeypatch, handler)
    csv_body = (
        "asset_tag,asset_type,manufacturer,model,status\n"
        "CSV-001,Laptop,Contoso,Alpha,available\n"
        "CSV-BAD,Laptop,Contoso,Broken,available\n"
        "CSV-002,Monitor,Fabrikam,Vision,assigned\n"
    )

    response = client.post(
        "/imports/assets",
        files={"file": ("assets.csv", csv_body, "text/csv")},
    )

    assert response.status_code == 200
    assert response.json()["imported"] == 2
    assert response.json()["skipped"] == 1
    assert response.json()["errors"]
    assert posted_tags == ["CSV-001", "CSV-002"]
