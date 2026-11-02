
using BrowserRPG.Core;
using Xunit;

namespace BrowserRPG.Core.Tests;

public class SharedWorldStateTests
{
    [Fact]
    public void MiningChangesSharedWorld()
    {
        World world = new World(8, 8);
        world.SetBlock(2, 3, BlockType.Stone);

        SharedWorldState state = new(world);

        bool success = state.TryEditBlock(2, 3, "mine");

        Assert.True(success);
        Assert.Equal(
            BlockType.Air,
            world.GetBlock(2, 3)
        );
    }

    [Fact]
    public void CannotPlaceIntoOccupiedBlock()
    {
        World world = new World(8, 8);
        world.SetBlock(2, 3, BlockType.Stone);

        SharedWorldState state = new(world);

        bool success = state.TryEditBlock(2, 3, "place");

        Assert.False(success);
        Assert.Equal(
            BlockType.Stone,
            world.GetBlock(2, 3)
        );
    }

    [Fact]
    public void BlockChangesWrapHorizontally()
    {
        World world = new World(8, 8);
        SharedWorldState state = new(world);

        bool success = state.TryEditBlock(-1, 3, "place");

        Assert.True(success);
        Assert.Equal(
            BlockType.Dirt,
            world.GetBlock(7, 3)
        );
    }
}
