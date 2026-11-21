import { View, div } from "gpui-kit";
import { theme } from "herdr";
import { GLYPH, stateIcon } from "./glyphs.js";

export default class ConductGlyphs extends View {
  render() {
    const t = theme();
    return div().flex().gap(8).children(Object.keys(GLYPH).map((status) => stateIcon(t, status, 12)));
  }
}
