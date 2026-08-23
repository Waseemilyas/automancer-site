import { describe, expect, it } from 'vitest';
import { runPage } from './support/storage-sentinel';

describe('storage sentinel bypass resistance', () => {
  it('records a Storage-prototype call that bypasses an instance property', () => {
    const result = runPage(`
      <script>
        Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(window.localStorage),
          'setItem'
        ).value.call(window.localStorage, 'bypass', '1');
      </script>
    `);

    expect(result.errors).toEqual([]);
    expect(result.touches).toContain('localStorage.setItem(bypass, 1)');
  });

  it('records storage reached through a fresh same-origin iframe', () => {
    const result = runPage(`
      <script>
        const frame = document.createElement('iframe');
        document.body.append(frame);
        frame.contentWindow.localStorage.setItem('iframe-bypass', '1');
      </script>
    `);

    expect(result.errors).toEqual([]);
    expect(result.touches).toContainEqual(expect.stringMatching(/\.setItem\(iframe-bypass, 1\)$/));
  });
});
