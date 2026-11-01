namespace BrowserRPG.Core;

public class WorldGenerator
{
    public const int WIDTH = 256;
    public const int HEIGHT = 256;

    public World World { get; private set; }

    public WorldGenerator()
    {
        World = new World(WIDTH, HEIGHT);
        Generate(); 
    }

    private void Generate()
    {
        for (int x = 0; x < WIDTH; x++)
        {
            double angle = 2.0 * Math.PI * x / WIDTH;

            int surfaceY = 23 + (int)Math.Round(
                4 * Math.Sin(angle * 3) +
                2 * Math.Sin(angle * 7)
            );

            for (int y = surfaceY; y < HEIGHT; y++)
            {
                BlockType blockType;

                if (y == surfaceY) blockType = BlockType.Grass;
                else if (y < surfaceY + 5) blockType = BlockType.Dirt;
                else blockType = BlockType.Stone;

                World.SetBlock(x, y, blockType);
            }
        }
    }

}
