import { describe, expect, test } from 'bun:test';
import { parseAnsi } from '../shared/ansi.ts';

describe('parseAnsi', () => {
  test('bold, red, reset, and merging', () => {
    expect(parseAnsi('\x1b[1;31mred\x1b[31m!\x1b[0m plain')).toEqual([[{ text: 'red!', bold: true, fg: 1 }, { text: ' plain' }]]);
  });
  test('256 colors', () => {
    expect(parseAnsi('\x1b[38;5;9ma\x1b[38;5;196mb\x1b[38;5;232mc')).toEqual([[
      { text: 'a', fg: 9 }, { text: 'b', fg: 'rgb(255,0,0)' }, { text: 'c', fg: 'rgb(8,8,8)' },
    ]]);
  });
  test('truecolor foreground and background', () => {
    expect(parseAnsi('\x1b[38;2;1;2;3;48;2;4;5;6mx')).toEqual([[{ text: 'x', fg: 'rgb(1,2,3)', bg: 'rgb(4,5,6)' }]]);
  });
  test('strips unrelated CSI and OSC', () => {
    expect(parseAnsi('a\x1b[2Cb\x1b]0;title\x07c\x1b]x\x1b\\d\x1bXe')).toEqual([[{ text: 'abcde' }]]);
  });
  test('splits CRLF and preserves empty lines', () => {
    expect(parseAnsi('a\r\n\r\nb')).toEqual([[{ text: 'a' }], [], [{ text: 'b' }]]);
  });
});
