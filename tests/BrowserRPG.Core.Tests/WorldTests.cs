
using BrowserRPG.Core;
using Xunit;

namespace BrowserRPG.Core.Tests;

public class WorldTests
{
    [Fact]
    public void NewWorldStartsWithAir()
    {
        World world = new World(10, 10);

        Assert.Equal(
            BlockType.Air,
            world.GetBlock(5, 5)
        );
    }

    [Fact]
    public void SetBlockChangesTheCorrectBlock()
    {
        World world = new World(10, 10);

        world.SetBlock(5, 5, BlockType.Stone);

        Assert.Equal(
            BlockType.Stone,
            world.GetBlock(5, 5)
        );

        Assert.Equal(
            BlockType.Air,
            world.GetBlock(6, 5)
        );
    }

    [Fact]
    public void WorldWrapsHorizontally()
    {
        World world = new World(10, 10);

        world.SetBlock(-1, 5, BlockType.Dirt);

        Assert.Equal(
            BlockType.Dirt,
            world.GetBlock(9, 5)
        );

        Assert.Equal(
            BlockType.Dirt,
            world.GetBlock(19, 5)
        );
    }

    [Fact]
    public void VerticalCoordinatesDoNotWrap()
    {
        World world = new World(10, 10);

        Assert.Throws<ArgumentOutOfRangeException>(
            () => world.GetBlock(0, -1)
        );

        Assert.Throws<ArgumentOutOfRangeException>(
            () => world.GetBlock(0, 10)
        );
    }

    [Fact]
    public void ExportedArrayContainsBlockIds()
    {
        World world = new World(4, 4);

        world.SetBlock(2, 1, BlockType.Stone);

        byte[] data = world.ToByteArray();

        Assert.Equal(16, data.Length);
        Assert.Equal((byte)BlockType.Stone, data[6]);
    }
}
