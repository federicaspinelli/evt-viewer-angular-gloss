export interface InputsType {
    [k: string]: any;
}
export interface OutputsType {
    [k: string]: OutputExpression | undefined;
}
export interface OutputWithArgs {
    handler: AnyFunction;
    args?: any[];
}
export declare type OutputExpression = EventHandler | OutputWithArgs;
export declare type EventHandler<T = any> = (event: T) => any;
export declare type AnyFunction = (...args: any[]) => any;
