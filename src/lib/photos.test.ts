import { describe, expect, it } from "vitest";
import { selectImageFiles, MAX_PHOTOS } from "./photos";

const image = (type = "image/jpeg") => ({ type, size: 1000 }) as File;
describe("photo intake", () => {
  it("caps selection at five for either input or drop", () => {
    expect(MAX_PHOTOS).toBe(5);
    const result = selectImageFiles([image(), image(), image()], 4);
    expect(result.files).toHaveLength(1);
    expect(result.errors.join(" ")).toContain("5");
  });
  it("rejects non-images, SVG and oversized source files", () => {
    const result = selectImageFiles(
      [
        image("text/plain"),
        image("image/svg+xml"),
        { ...image(), size: 21 * 1024 * 1024 } as File,
        image(),
      ],
      0,
    );
    expect(result.files).toHaveLength(1);
    expect(result.errors).toHaveLength(3);
  });
  it("does not accept images when already full", () => {
    expect(selectImageFiles([image()], 5).files).toHaveLength(0);
  });
});
