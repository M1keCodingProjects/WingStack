export default class Binary { // :bin
    constructor(value, isNeg = false) { // ok
        this.neg   = isNeg;
        this.value = value;
    }
    
    copy() { // ok
        return new Binary(new Uint8Array(this.value), this.neg);
    }
    
    static get emptyValue() { // ok
        return new Uint8Array(1);
    }

    static fromToken(token) { // ok
        const isNeg = token.neg ?? false;
        const value = token.value;
        return new Binary(this.toDigitList(value), isNeg);
    }

    static fromBool(value) { // ok
        return new Binary(new Uint8Array(1).fill(!!value));
    }

    static fromNum(value) { // ok
        const binVal = value.toString(2);
        return new Binary(this.toDigitList(binVal), value < 0);
    }

    static fromStr(value) { // ok
        const token = {
            neg   : value[0] == "-",
            value : value.replace(/^\-?b/, ""),
        };
        return Binary.fromToken(token);
    }

    static fromMany(values) { // ok
        let i = -1;
        const resValue    = [];
        let foundFirstOne = false;
        while (i < values.length - 1) {
            i++;
            const digit = values[i];
            if(!foundFirstOne) foundFirstOne = Binary.toBool(digit);
            if(!foundFirstOne) continue;
            if(digit instanceof Binary) resValue.unshift(...digit.value);
            else resValue.unshift(digit);
        }
        return new Binary(new Uint8Array(resValue), values[0].neg || values[0] < 0);
    }
    
    static toDigitList(value) { // ok
        value = value.slice(value.search("1"));
        if(value === "") return Binary.emptyValue;
        const digitArray = new Uint8Array(value.length);
        for(let i = 0; i < value.length; i++) digitArray[i] = value[value.length - i - 1] == 1;
        return digitArray;
    }

    static toBool(value) { // ok
        return value instanceof Binary ? !value.isZero() : value != 0;
    }

    static isValidDigit(value) { // ok
        return value.isBool?.() || value === 1 || value === 0;
    }

    toBase10(value) { // ok
        return value.reduceRight((acc, digit) => acc << 1 | digit, 0);
    }

    toNum() { // ok
        return this.toBase10(this.value) * (1 - 2 * this.neg);
    }

    toStr() { // ok
        const strValue = `b${this.value.toReversed().join("")}`;
        return this.neg ? "-" + strValue : strValue;
    }

    isBool() { // ok
        return this.value.length == 1 && !this.neg;
    }

    isZero() { // ok
        return this.isBool() && !this.value[0];
    }

    isOne() { // ok
        return this.isBool() && this.value[0];
    }

    minimize() { // ok
        for(let i = this.value.length - 1; i >= 0; i--) {
            if(this.value[i]) return this.value = this.value.subarray(0, i + 1); // uncaught
        }
        this.value = Binary.emptyValue;
    }

    not() { // ok
        for(let i = 0; i < this.value.length; i++) this.value[i] = !this.value[i];
        this.minimize();
        return this;
    }

    and(that, thatType) { // ok
        if(!thatType.canBe("bin")) return Binary.fromBool(that !== 0);
        this.neg = this.neg && that.neg;
        if(that.value.length < this.value.length)  this.value = this.value.subarray(0, that.value.length);
        for(let i = 0; i < this.value.length; i++) this.value[i] &= that.value[i];
        this.minimize();
        return this;
    }

    or(that, thatType) { // ok
        if(!thatType.canBe("bin")) return Binary.fromBool(that !== 0 || !this.isBool() || this.value[0]);
        this.neg = this.neg || that.neg;
        const resValue = new Uint8Array(Math.max(this.value.length, that.value.length));
        for(let i = 0; i < resValue.length; i++) resValue[i] = this.value[i] | that.value[i];
        this.value = resValue;
        return this;
    }

    shiftR(amt) { // ok
        this.value = amt < this.value.length ? this.value.subarray(amt) : Binary.emptyValue;
        return this;
    }

    shiftL(amt) { // ok
        if(!this.isZero()) {
            const resValue = new Uint8Array(this.value.length + amt);
            resValue.set(this.value, amt);
            this.value = resValue;
        }
        return this;
    }

    getDigit(pos) { // ok
        return Binary.fromBool(this.value[pos]);
    }

    assignDigit(pos, value) { // ok
        this.value[pos] = value;
        this.minimize();
    }

    addTopDigit(value) { // ok
        if(!value) return;
        const resValue = new Uint8Array(this.value.length + 1);
        resValue.set(this.value);
        resValue[this.value.length] = value;
        this.value = resValue;
    }

    addBottomDigit(value) { // ok
        this.shiftL(1);
        this.value[0] = value;
    }

    deleteDigit(pos) { // ok
        const resValue = new Uint8Array(this.value.length - 1);
        resValue.set(this.value.subarray(0, pos));
        resValue.set(this.value.subarray(pos + 1), pos);
        this.value = resValue;
        this.minimize();
    }
}