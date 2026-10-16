#version 300 es
// Spec 03a: one-off pass at load. Unpacks 02's elevation into metres in a filterable R16F texture of the same size,
// so the palette's elevation curve can sample it smoothly. Same packing as ../../../shaders/slope.frag.
precision highp float;
precision highp int;

uniform highp sampler2D uElevation; // packed 16-bit: round(metres) + 32768, R = high byte, G = low byte

out vec4 fragColor;

void main() {
  vec2 rg = floor(texelFetch(uElevation, ivec2(gl_FragCoord.xy), 0).rg * 255.0 + 0.5);
  fragColor = vec4(rg.x * 256.0 + rg.y - 32768.0, 0.0, 0.0, 1.0);
}
