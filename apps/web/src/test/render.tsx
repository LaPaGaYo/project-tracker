import type { ReactElement } from "react";

import { render as rtlRender } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";

export function render(ui: ReactElement): RenderResult {
  return rtlRender(ui);
}
