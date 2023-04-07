const createMatchPatterns = str => str.split("").map(ch => [new RegExp(`^\\${ch}`, "g"), ch]);

export const NUMBER_MATCH_PATTERN = /^-?\d+(_\d{3})*(\.\d+)?/; ///^-?\d+(\.\d+)?/;
const TOKEN_MATCH_PATTERNS = [
    [/^ +/, "space"],
    [/^#.*/, "comment"],
    [/^\n+/, "EOL"],
    [NUMBER_MATCH_PATTERN, "num"],
    [/^(\+|\-|\*|\/|\=\=|<|>)/, "op"],
    ...createMatchPatterns("()[]{}.,;:?=|"),
    [/^((\"[^\"\n]*\"?)|(\'[^\'\n]*\'?))/, "str"],
    [/^-?[a-zA-Z_](\w|<|>)*/, "WORD"],
    [/^./, "any"],
];

const HIGHLIGHT_KEYWORDS = {
    print   : "keyword",
    make    : "keyword",
    macro   : "keyword",
    expand  : "keyword",
    loop    : "keyword",
    when    : "keyword",
    else    : "keyword",
    free    : "keyword",
    fun     : "keyword",
    exit    : "keyword",
    next    : "keyword",
    typenum : "keyword",
    use     : "keyword",
    match   : "keyword",
    with    : "keyword",
    global  : "keyword",
    dynamic : "keyword",
    class   : "keyword",
    frozen  : "keyword",
    then    : "keyword",

    PI    : "num",
    INF   : "num",
    FALSE : "num",
    TRUE  : "num",

    me             : "instance",
    origin         : "instance",
    runtimeElapsed : "instance",

    Error         : "errorClass",
    TypeError     : "errorClass",
    ValueError    : "errorClass",
    PropertyError : "errorClass",

    "rot<" : "stackOp",
    "rot>" : "stackOp",
    dup    : "stackOp",
    drop   : "stackOp",
    num    : "stackOp",
    int    : "stackOp",
    float  : "stackOp",
    str    : "stackOp",
    char   : "stackOp",
    list   : "stackOp",
    obj    : "stackOp",
    void   : "stackOp",
    spill  : "stackOp",
    swap   : "stackOp",
    over   : "stackOp",
    and    : "stackOp",
    or     : "stackOp",
    not    : "stackOp",
    type   : "stackOp",
    size   : "stackOp",
    pop    : "stackOp",
    inp    : "stackOp",
    flip   : "stackOp",
    rand   : "stackOp",
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