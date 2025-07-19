import { onMount } from "solid-js";
import { deviceManager } from "../store";

const PIXEL_W = 128;
const PIXEL_H = 64;
const PIXEL_SIZE = 2;
const PIXEL_SPACING = 1;
const PIXEL_SIDE_MARGIN = 6;

const W =
  PIXEL_W * PIXEL_SIZE + (PIXEL_W - 1) * PIXEL_SPACING + 2 * PIXEL_SIDE_MARGIN;
const H =
  PIXEL_H * PIXEL_SIZE + (PIXEL_H - 1) * PIXEL_SPACING + 2 * PIXEL_SIDE_MARGIN;

export default function Screen() {
  /** @type {HTMLCanvasElement | null} */
  let canvas = <canvas width={W} height={H} />;

  onMount(() => {
    let ctx = canvas.getContext("2d");
    renderScreen(ctx, canvas);

    deviceManager.onScreenData = () => renderScreen(ctx, canvas);

    deviceManager.readScreen();
  });

  return <div class="overflow-clip rounded-md shadow">{canvas}</div>;
}

/**  */
function renderScreen(ctx, canvas) {
  ctx.fillStyle = "#1a1a1f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < PIXEL_H; i++) {
    ctx.fillStyle = i >= 15 ? "#00bfff" : "#ffff00";

    for (let j = 0; j < PIXEL_W; j++) {
      // const is_corner =
      //   (j == 0) + (j == PIXEL_W - 1) + (i == 0) + (i == PIXEL_H - 1) == 2;
      // if (is_corner) continue;
      const y = PIXEL_SIDE_MARGIN + i * (PIXEL_SPACING + PIXEL_SIZE);
      const x = PIXEL_SIDE_MARGIN + j * (PIXEL_SPACING + PIXEL_SIZE);

      if (deviceManager.isPixelOn(j, i)) ctx.fillRect(x, y, 2, 2);
    }
  }
}
