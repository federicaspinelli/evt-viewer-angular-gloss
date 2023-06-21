import { KeyValueChangeRecord, SimpleChange, Type } from '@angular/core';
export declare type KeyValueChangeRecordAny = KeyValueChangeRecord<any, any>;
export declare function createNewChange(val: any): SimpleChange;
export declare function createChange(val: any, prevVal: any): SimpleChange;
export declare function noop(): void;
export declare function getCtorParamTypes(ctor: any, reflect: {
    getMetadata: (type: string, obj: object) => any[];
}): any[];
/**
 * Extract type arguments from Angular Directive/Component
 */
export declare function extractNgParamTypes(type: Type<any>): any[] | undefined;
