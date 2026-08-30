import { describe, expect, it } from 'vitest';
import { contentPages, readDistFile } from './support/dist';

const services = contentPages().find((page) => page.route === '/services/');
const stylesheet = services?.doc.querySelector('link[rel="stylesheet"][href^="/_astro/"]')?.getAttribute('href');
const css = stylesheet ? readDistFile(stylesheet.slice(1)) : null;

function declaration(selector: string, property: string): string {
  expect(css, 'services stylesheet was not emitted').toBeTruthy();
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = css!.match(new RegExp(`${escaped}\\{([^}]*)\\}`))?.[1];
  const value = block?.match(new RegExp(`(?:^|;)${property}:([^;}]+)`))?.[1];
  expect(value, `${selector} has no ${property} declaration`).toBeTruthy();
  return value!;
}

function rgb(value: string): [number, number, number] {
  const variable = value.match(/^var\(--([^)]+)\)$/)?.[1];
  if (variable) {
    const resolved = css!.match(new RegExp(`--${variable}:([^;}]+)`))?.[1];
    expect(resolved, `--${variable} is undefined`).toBeTruthy();
    return rgb(resolved!);
  }

  const hex = value.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  expect(hex, `unsupported colour: ${value}`).toBeTruthy();
  const full = hex!.length === 3 ? [...hex!].map((digit) => digit + digit).join('') : hex!;
  return [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16)) as [number, number, number];
}

function contrast(foreground: string, background: string): number {
  const luminance = (colour: string) => {
    const [r, g, b] = rgb(colour).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('services offer labels', () => {
  it.each([
    ['light', '.on-paper .offer__includes h3', '.on-paper'],
    ['dark', '.offer__includes h3', '.on-dark'],
  ])('meets WCAG AA on the %s offer sections', (_name, textSelector, surfaceSelector) => {
    const ratio = contrast(declaration(textSelector, 'color'), declaration(surfaceSelector, 'background'));
    expect(ratio, `${textSelector} contrast is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });
});
