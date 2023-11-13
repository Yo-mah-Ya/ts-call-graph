import { omitCommentsFromJson } from "./misc";

describe("omitCommentsFromJson", () => {
  test("omit comments", () => {
    expect(omitCommentsFromJson('//comment\n{"a":"b"}')).toStrictEqual(
      '\n{"a":"b"}',
    );
    expect(omitCommentsFromJson('/*//comment*/{"a":"b"}')).toStrictEqual(
      '{"a":"b"}',
    );
    expect(omitCommentsFromJson('{"a":"b"//comment\n}')).toStrictEqual(
      '{"a":"b"\n}',
    );
    expect(omitCommentsFromJson('{"a":"b"/*comment*/}')).toStrictEqual(
      '{"a":"b"}',
    );
    expect(
      omitCommentsFromJson('{"a"/*\n\n\ncomment\r\n*/:"b"}'),
    ).toStrictEqual('{"a":"b"}');
    expect(
      omitCommentsFromJson('/*!\n * comment\n */\n{"a":"b"}'),
    ).toStrictEqual('\n{"a":"b"}');
    expect(omitCommentsFromJson('{/*comment*/"a":"b"}')).toStrictEqual(
      '{"a":"b"}',
    );
  });

  test("doesn't omit comments inside strings", () => {
    expect(omitCommentsFromJson('{"a":"b//c"}')).toStrictEqual('{"a":"b//c"}');
    expect(omitCommentsFromJson('{"a":"b/*c*/"}')).toStrictEqual(
      '{"a":"b/*c*/"}',
    );
    expect(omitCommentsFromJson('{"/*a":"b"}')).toStrictEqual('{"/*a":"b"}');
    expect(() => omitCommentsFromJson('{"\\"/*a":"b"}')).toThrow(
      new Error("unclosed block comment"),
    );
  });
});
