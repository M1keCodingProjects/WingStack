function* iota_generator(start = 0) {
    let i = start;
    while(true) yield i++;
}

let iota_iterator;
export default function iota(start = null) {
    if(start !== null) iota_iterator = iota_generator(start);
    return iota_iterator ? iota_iterator.next().value : iota(0);
}