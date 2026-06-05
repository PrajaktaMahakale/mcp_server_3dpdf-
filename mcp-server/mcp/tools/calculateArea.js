export function calculateArea({ width, height }) {
  if (typeof width !== "number" || typeof height !== "number") {
    throw new Error("Invalid arguments: width and height must be numbers.");
  }
  return width * height;
}
