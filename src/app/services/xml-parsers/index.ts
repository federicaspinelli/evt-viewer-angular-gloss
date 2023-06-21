import { Type } from '@angular/core';
import { Comment, GenericElement, HTML, XMLElement } from '../../models/evt-models';
import { Map } from '../../utils/js-utils';
import { createParser, Parser, ParseResult } from './parser-models';

export class ParserRegister {
    // tslint:disable-next-line: no-any
    private static PARSER_MAP: Map<Type<any>> = {};

    // tslint:disable-next-line: no-any
    static set(tagName: string, parserType: Type<any>) {
        ParserRegister.PARSER_MAP[tagName.toLowerCase()] = parserType;
    }

    static get<T>(tagName: string): Parser<T> {
        const name = ParserRegister.mapName(tagName.toLowerCase());

        return createParser(ParserRegister.PARSER_MAP[name], parse) as Parser<T>;
    }

    private static mapName(tagName) {
        const nes = ['event', 'geogname', 'orgname', 'persname', 'placename'];
        if (nes.includes(tagName)) {
            return 'evt-named-entity-parser';
        }
        const nels = ['listPerson', 'listPlace', 'listOrg', 'listEvent'];
        if (nels.includes(tagName)) {
            return 'evt-named-entities-list-parser';
        }
        const crit = ['app'];
        if (crit.includes(tagName)) {
            return 'evt-apparatus-entry-parser';
        }
        /* add by FS
        const ling = ['rdgGrp'];
        if (ling.includes(tagName)) {
            return 'evt-lem-entry-parser';
        } */

        // add by FS - add here new tag for CPD
        
        const neslem = ['w', 'lem'];
        if (neslem.includes(tagName)) {
            return 'evt-lemmatized-entity-parser';
        }
        const nelslem = ['list'];
        if (nelslem.includes(tagName)) {
            return 'evt-lemmatized-entities-list-parser';
        }

        if (!Object.keys(ParserRegister.PARSER_MAP).includes(tagName)) {
            return 'evt-generic-elem-parser';
        }

        return tagName;
    }
}

// tslint:disable-next-line: no-any
export function xmlParser(tagName: string, parserType: Type<any>) {

    // tslint:disable-next-line: no-any
    return (_: Type<any>) => {
        ParserRegister.set(tagName, parserType);
    };
}

export function parse(xml: XMLElement): ParseResult<GenericElement> {
    if (!xml) { return { content: [xml] } as HTML; }
    // Text Node
    if (xml.nodeType === 3) { return ParserRegister.get('evt-text-parser').parse(xml); }
    // Comment
    if (xml.nodeType === 8) { return {} as Comment; }
    const tagName = xml.tagName.toLowerCase();
    const parser: Parser<XMLElement> = ParserRegister.get(tagName);

    return parser.parse(xml);
}
