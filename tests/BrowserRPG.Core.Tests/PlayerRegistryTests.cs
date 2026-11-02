
using BrowserRPG.Core;
using Xunit;

namespace BrowserRPG.Core.Tests;

public class PlayerRegistryTests
{
    [Fact]
    public void RegisterCreatesPlayer()
    {
        PlayerRegistry registry = new();

        Guid id = registry.Register(10, 20);

        PlayerSnapshot[] players = registry.GetSnapshot();

        Assert.Single(players);
        Assert.Equal(id, players[0].Id);
        Assert.Equal(10, players[0].X);
        Assert.Equal(20, players[0].Y);
    }

    [Fact]
    public void PositionCanBeUpdated()
    {
        PlayerRegistry registry = new();

        Guid id = registry.Register(10, 20);

        bool success = registry.UpdatePosition(
            id, 15, 25
        );

        Assert.True(success);

        PlayerSnapshot player =
            Assert.Single(registry.GetSnapshot());

        Assert.Equal(15, player.X);
        Assert.Equal(25, player.Y);
    }

    [Fact]
    public void CannotUpdateUnknownPlayer()
    {
        PlayerRegistry registry = new();

        bool success = registry.UpdatePosition(
            Guid.NewGuid(), 10, 20
        );

        Assert.False(success);
    }

    [Fact]
    public void UnregisterRemovesPlayer()
    {
        PlayerRegistry registry = new();

        Guid id = registry.Register(10, 20);

        bool removed = registry.Unregister(id);

        Assert.True(removed);
        Assert.Empty(registry.GetSnapshot());
    }
}
