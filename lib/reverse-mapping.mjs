const KEY_INDEX = 0;
export const keyOfValue = (object, value) => {
    const entry = Object.entries(object).find(([, entryValue]) => entryValue === value);
    if (!entry) {
        throw new Error(`Unknown value: ${String(value)}`);
    }
    return entry[KEY_INDEX];
};
//# sourceMappingURL=reverse-mapping.mjs.map