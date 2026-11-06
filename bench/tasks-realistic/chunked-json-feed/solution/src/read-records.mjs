export async function* readRecords(chunks) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  let lineNumber = 0;
  const parse = (line) => {
    lineNumber++;
    if (!line.trim()) return { present: false };
    try {
      return { present: true, value: JSON.parse(line) };
    } catch (error) {
      throw new SyntaxError(`invalid JSON on line ${lineNumber}: ${error.message}`);
    }
  };
  for await (const chunk of chunks) {
    pending += decoder.decode(chunk, { stream: true });
    let newline;
    while ((newline = pending.indexOf("\n")) !== -1) {
      const record = parse(pending.slice(0, newline));
      pending = pending.slice(newline + 1);
      if (record.present) yield record.value;
    }
  }
  pending += decoder.decode();
  if (pending.length) {
    const record = parse(pending);
    if (record.present) yield record.value;
  }
}
