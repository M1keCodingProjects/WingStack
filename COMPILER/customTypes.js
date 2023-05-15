export default class Binary { // :bin
    constructor(value, isNeg = false) {
        this.neg   = isNeg;
        this.value = value;
    }
    
    copy() {
        return new Binary([...this.value], this.neg);
    }
    
    static fromToken(token) {
        const isNeg = token.neg ?? false;
        const value = token.value;
        return new Binary(this.toDigitList(value), isNeg);
    }

    static fromBool(value) {
        return new Binary([!!value]);
    }

    static fromNum(value) {
        const binVal = value.toString(2);
        return new Binary(this.toDigitList(binVal), value < 0);
    }

    static fromStr(value) {
        const token = {
            neg   : value[0] == "-",
            value : value.replace(/^\-?b/, ""),
        };
        return Binary.fromToken(token);
    }

    static fromMany(values) {
        const res = new Binary(
            values.reduceRight((acc, item) => {
                item instanceof Binary ?
                acc.push(...item.value) :
                acc.push(item != 0);
                return acc;
            }, []),
            values[0].neg || values[0] < 0
        );
        res.minimize();
        return res;
    }
    
    static toDigitList(value) {
        const lastOne = value.search("1");
        return lastOne >= 0 ? value.slice(lastOne).split("").reverse().map(e => e == 1) : [false];
    }

    static toBool(value) {
        return value.value?.[0] || value == 1;
    }

    static isValidDigit(value) {
        return value.isBool?.() || value === 1 || value === 0;
    }

    toBase10(value) {
        return value.reduce((acc, digit, i) => acc + digit * 2 ** i, 0);
    }

    toNum() {
        return this.toBase10(this.value) * (1 - 2 * this.neg);
    }

    toStr() {
        return `${"-".repeat(this.neg)}b${this.value.slice().reverse().reduce((acc, digit) => acc + 1 * digit, "")}`;
    }

    isBool() {
        return this.value.length == 1 && !this.neg;
    }

    isZero() {
        return this.isBool() && !this.value[0];
    }

    isOne() {
        return this.isBool() && this.value[0];
    }

    minimize() {
        for(let i = this.value.length - 1; i >= 0; i--) {
            if(this.value[i]) return this.value.splice(i + 1); // uncaught.
        }
        this.value = [false];
    }

    not() {
       this.value = this.value.map(digit => !digit);
       this.minimize();
       return this;
    }

    and(that, thatType) {
        if(!thatType.canBe("bin")) return Binary.fromBool(that !== 0);
        this.neg   = this.neg && that.neg;
        this.value = this.value.map((digit, i) => digit && (that.value[i] || false));
        this.minimize();
        return this;
    }

    or(that, thatType) {
        if(!thatType.canBe("bin")) return Binary.fromBool(that !== 0 || !this.isBool() || this.value[0]);
        this.neg   = this.neg || that.neg;
        this.value = this.value.length >= that.value.length ?
                     this.value.map((digit, i) => digit || (that.value[i] || false)) :
                     that.value.map((digit, i) => digit || (this.value[i] || false));
        
        this.minimize();
        return this;
    }

    shiftR(amt) {
        if(amt >= this.value.length) this.value = [false];
        else this.value.splice(0, amt);
        return this;
    }

    shiftL(amt) {
        if(!this.isZero()) this.value.unshift(...Array(amt).fill(false));
        return this;
    }

    getDigit(pos) {
        return Binary.fromBool(this.value[pos]);
    }

    assignDigit(pos, value) {
        if(!value && pos == this.value.length - 1) this.value.pop();
        else this.value[pos] = value;
    }

    addTopDigit(value) {
        if(value) this.value.push(value);
    }

    addBottomDigit(value) {
        this.value.unshift(value);
    }
}