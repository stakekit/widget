type Fn<T> = (data: T) => void;

export class Observable<T> {
  #observers = new Map<Fn<T>, Fn<T>>();
  #data: T;

  constructor(data: T) {
    this.#data = data;
  }

  subscribe(observer: Fn<T>) {
    this.#observers.set(observer, observer);

    return () => this.unsubscribe(observer);
  }

  next(data: T) {
    this.#data = data;
    this.#observers.forEach((observer) => observer(this.#data));
  }

  unsubscribe(observer: Fn<T>) {
    this.#observers.delete(observer);
  }

  map<U>(fn: (data: T) => U) {
    const observable = new Observable(fn(this.#data));

    const fnKey = (data: T) => observable.next(fn(data));
    const sub = () => this.subscribe(fnKey);
    const unsub = () => this.unsubscribe(fnKey);

    return new Proxy(observable, {
      get(target, p, receiver) {
        if (p === "subscribe") {
          sub();
        } else if (p === "unsubscribe") {
          unsub();
        }

        return Reflect.get(target, p, receiver);
      },
    });
  }

  get value() {
    return this.#data;
  }
}
