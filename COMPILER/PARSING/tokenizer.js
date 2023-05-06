const createMatchPatterns = str => str.split("").map(ch => [new RegExp(`^\\${ch}`, "g"), ch]);

export const NUMBER_MATCH_PATTERN = /^-?\d+(_\d{3})*(\.\d+)?/; ///^-?\d+(\.\d+)?/;
const TOKEN_MATCH_PATTERNS = [
    [/^ +/, "space"],
    [/^#.*/, "comment"],
    [/^\n+/, "EOL"],
    [NUMBER_MATCH_PATTERN, "num"],
    [/^(%|\+|\-|\^|\*|\/|\=\=|<<|>>|((<|>)\=?))/, "op"],
    ...createMatchPatterns("()[]{}.,;:?=|"),
    [/^\@/, "apply"],
    [/^((\"[^\"\n]*\"?)|(\'[^\'\n]*\'?))/, "str"],
    [/^-?[a-zA-Z_](\w|<|>)*/, "WORD"],
    [/^./, "any"],
];

const HIGHLIGHT_KEYWORDS = {
    print   : "keyword",
    make    : "keyword",
    macro   : "keyword",
    loop    : "keyword",
    if      : "keyword",
    else    : "keyword",
    free    : "keyword",
    fun     : "keyword",
    exit    : "keyword",
    next    : "keyword",
    enum    : "keyword",
    import  : "keyword",
    match   : "keyword",
    with    : "keyword",
    const   : "keyword",
    global  : "keyword",
    dynamic : "keyword",
    type    : "keyword",
    class   : "keyword",
    then    : "keyword",
    from    : "keyword",
    ref     : "keyword",

    PI    : "num",
    INF   : "num",
    FALSE : "num",
    TRUE  : "num",

    self   : "instance",
    origin : "instance",
    time   : "instance",

    "rot<" : "stackOp",
    "rot>" : "stackOp",
    dup    : "stackOp",
    drop   : "stackOp",
    char   : "stackOp",
    spill  : "stackOp",
    swap   : "stackOp",
    over   : "stackOp",
    and    : "stackOp",
    or     : "stackOp",
    not    : "stackOp",
    typeof : "stackOp",
    size   : "stackOp",
    pop    : "stackOp",
    inp    : "stackOp",
    flip   : "stackOp",
    rand   : "stackOp",

    num    : "type",
    int    : "type",
    float  : "type",
    str    : "type",
    list   : "type",
    obj    : "type",
    func   : "type",
    err    : "type",
    void   : "type",
};

export default function tokenize(text, onMatchedToken_callback = () => {}, ...args) {
    let cursor = 0;
    while(cursor < text.length) {
        const stream = text.substring(cursor);
        for(let [regExp, tokenType] of TOKEN_MATCH_PATTERNS) {
            const match = stream.match(regExp)?.[0] || null;
            if(match === null) continue;
            cursor += match.length;
            
            if(tokenType == "WORD" && match in HIGHLIGHT_KEYWORDS) tokenType = HIGHLIGHT_KEYWORDS[match];
            onMatchedToken_callback(match, tokenType, ...args);
            break;
        }
    }
}