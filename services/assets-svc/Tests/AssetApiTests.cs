using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Contoso.Assets.Data;
using Dapper;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace Contoso.Assets.Tests;

public sealed class AssetApiFactory : WebApplicationFactory<Program>
{
    private readonly string _dbPath = Path.Combine(
        Path.GetTempPath(),
        $"asset-api-tests-{Guid.NewGuid():N}.db");
    private readonly string? _originalDbPath;

    public AssetApiFactory()
    {
        _originalDbPath = Environment.GetEnvironmentVariable("ASSETS_DB_PATH");
        Environment.SetEnvironmentVariable("ASSETS_DB_PATH", _dbPath);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<AssetsDb>();
            services.AddSingleton(new AssetsDb(_dbPath));
        });
    }

    public void Reset()
    {
        var db = Services.GetRequiredService<AssetsDb>();
        using var connection = db.Open();
        connection.Execute("DELETE FROM assets;");
        connection.Execute("""
            INSERT INTO assets
                (id, asset_tag, asset_type, manufacturer, model, serial_number,
                 purchase_date, warranty_expiry, status, notes)
            VALUES
                (1, 'TEST-LPT-001', 'Laptop', 'Contoso', 'Alpha', 'SER-001',
                 '2024-01-10', '2027-01-10', 'available', 'Fixture laptop'),
                (2, 'TEST-MON-001', 'Monitor', 'Fabrikam', 'Vision', 'SER-002',
                 '2023-02-20', '2026-02-20', 'assigned', NULL),
                (3, 'TEST-LPT-002', 'Laptop', 'Fabrikam', 'RoadRunner', NULL,
                 NULL, NULL, 'assigned', 'Second fixture laptop'),
                (4, 'TEST-PHN-001', 'Phone', 'Northwind', 'Talker', 'SER-004',
                 NULL, NULL, 'retired', NULL);
        """);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        Environment.SetEnvironmentVariable("ASSETS_DB_PATH", _originalDbPath);
        SqliteConnection.ClearAllPools();
        if (File.Exists(_dbPath))
        {
            File.Delete(_dbPath);
        }
    }
}

public sealed class AssetApiTests : IClassFixture<AssetApiFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly HttpClient _client;

    public AssetApiTests(AssetApiFactory factory)
    {
        _client = factory.CreateClient();
        factory.Reset();
    }

    [Fact]
    public async Task Create_with_valid_asset_persists_and_returns_location()
    {
        var response = await _client.PostAsJsonAsync("/assets", NewAsset("TEST-NEW-001"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<CreatedAsset>(JsonOptions);
        Assert.NotNull(created);
        Assert.Equal($"/assets/{created.Id}", response.Headers.Location?.ToString());

        var asset = await _client.GetFromJsonAsync<AssetResponse>($"/assets/{created.Id}", JsonOptions);
        Assert.NotNull(asset);
        Assert.Equal("TEST-NEW-001", asset.AssetTag);
        Assert.Equal("available", asset.Status);
    }

    [Fact]
    public async Task Create_with_empty_required_fields_documents_missing_validation()
    {
        var response = await _client.PostAsJsonAsync("/assets", new
        {
            assetTag = "",
            assetType = "",
            manufacturer = "",
            model = "",
            status = "",
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task Create_with_invalid_data_type_returns_bad_request()
    {
        using var content = new StringContent(
            """{"assetTag":{"invalid":true},"assetType":"Laptop","manufacturer":"Contoso","model":"Alpha","status":"available"}""",
            Encoding.UTF8,
            "application/json");

        var response = await _client.PostAsync("/assets", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Read_existing_asset_returns_fixture()
    {
        var response = await _client.GetAsync("/assets/1");
        var asset = await response.Content.ReadFromJsonAsync<AssetResponse>(JsonOptions);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(asset);
        Assert.Equal("TEST-LPT-001", asset.AssetTag);
    }

    [Theory]
    [InlineData("/assets/99999")]
    [InlineData("/assets/not-an-id")]
    public async Task Read_unknown_or_malformed_id_returns_not_found(string path)
    {
        var response = await _client.GetAsync(path);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Update_existing_asset_replaces_values()
    {
        var update = NewAsset("TEST-LPT-001") with
        {
            Model = "Updated",
            Status = "assigned",
            Notes = "Updated notes",
        };

        var response = await _client.PutAsJsonAsync("/assets/1", update);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var asset = await _client.GetFromJsonAsync<AssetResponse>("/assets/1", JsonOptions);
        Assert.NotNull(asset);
        Assert.Equal("Updated", asset.Model);
        Assert.Equal("assigned", asset.Status);
        Assert.Equal("Updated notes", asset.Notes);
    }

    [Fact]
    public async Task Update_with_only_required_values_clears_optional_values()
    {
        var response = await _client.PutAsJsonAsync("/assets/1", new
        {
            assetTag = "TEST-LPT-001",
            assetType = "Laptop",
            manufacturer = "Contoso",
            model = "Partial",
            status = "available",
        });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var asset = await _client.GetFromJsonAsync<AssetResponse>("/assets/1", JsonOptions);
        Assert.NotNull(asset);
        Assert.Equal("Partial", asset.Model);
        Assert.Null(asset.SerialNumber);
        Assert.Null(asset.PurchaseDate);
        Assert.Null(asset.WarrantyExpiry);
        Assert.Null(asset.Notes);
    }

    [Fact]
    public async Task Update_nonexistent_asset_returns_not_found()
    {
        var response = await _client.PutAsJsonAsync("/assets/99999", NewAsset("TEST-MISSING"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Delete_existing_asset_then_repeated_delete_returns_not_found()
    {
        var first = await _client.DeleteAsync("/assets/1");
        var second = await _client.DeleteAsync("/assets/1");

        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, second.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/assets/1")).StatusCode);
    }

    [Fact]
    public async Task Delete_nonexistent_asset_returns_not_found()
    {
        var response = await _client.DeleteAsync("/assets/99999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("type=Laptop", "TEST-LPT-001", "TEST-LPT-002")]
    [InlineData("status=retired", "TEST-PHN-001")]
    [InlineData("q=Vision", "TEST-MON-001")]
    public async Task Search_filters_by_single_criterion(string query, params string[] expectedTags)
    {
        var assets = await _client.GetFromJsonAsync<List<AssetResponse>>(
            $"/assets/search?{query}",
            JsonOptions);

        Assert.NotNull(assets);
        Assert.Equal(expectedTags, assets.Select(asset => asset.AssetTag));
    }

    [Fact]
    public async Task Search_combines_filters()
    {
        var assets = await _client.GetFromJsonAsync<List<AssetResponse>>(
            "/assets/search?type=Laptop&status=assigned&q=Fabrikam",
            JsonOptions);

        var asset = Assert.Single(assets!);
        Assert.Equal("TEST-LPT-002", asset.AssetTag);
    }

    [Fact]
    public async Task Search_with_no_matches_returns_empty_array()
    {
        var assets = await _client.GetFromJsonAsync<List<AssetResponse>>(
            "/assets/search?q=does-not-exist",
            JsonOptions);

        Assert.NotNull(assets);
        Assert.Empty(assets);
    }

    [Fact]
    public async Task Stats_by_status_returns_fixture_counts()
    {
        var stats = await _client.GetFromJsonAsync<Dictionary<string, int>>(
            "/assets/stats/by-status",
            JsonOptions);

        Assert.NotNull(stats);
        Assert.Equal(1, stats["available"]);
        Assert.Equal(2, stats["assigned"]);
        Assert.Equal(1, stats["retired"]);
    }

    private static AssetRequest NewAsset(string tag) => new(
        tag,
        "Laptop",
        "Contoso",
        "Alpha",
        "SER-NEW",
        "2026-01-01",
        "2028-01-01",
        "available",
        "Created by API test");

    private sealed record AssetRequest(
        string AssetTag,
        string AssetType,
        string Manufacturer,
        string Model,
        string? SerialNumber,
        string? PurchaseDate,
        string? WarrantyExpiry,
        string Status,
        string? Notes);

    private sealed record CreatedAsset(long Id);

    private sealed record AssetResponse(
        long Id,
        string AssetTag,
        string AssetType,
        string Manufacturer,
        string Model,
        string? SerialNumber,
        string? PurchaseDate,
        string? WarrantyExpiry,
        string Status,
        string? Notes);
}
