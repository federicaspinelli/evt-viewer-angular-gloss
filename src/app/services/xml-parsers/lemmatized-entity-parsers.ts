import { AppConfig } from 'src/app/app.config';
import { ParserRegister, xmlParser } from '.';
import {
    GenericElement, LemmatizedEntitiesList, LemmatizedEntity, LemmatizedEntityInfo, LemmatizedEntityLabel,
    LemmatizedEntityRef, LemmatizedEntityType, Relation, XMLElement,
} from '../../models/evt-models';
import { xpath } from '../../utils/dom-utils';
import { replaceNewLines } from '../../utils/xml-utils';
import { AttributeMapParser, AttributeParser, EmptyParser, GenericElemParser, TextParser } from './basic-parsers';
import { createParser, parseChildren, Parser } from './parser-models';

// add by FS - add here new tag for CPD
export const lemmatizedEntitiesListsTagNamesMap: { [key: string]: string } = {
    lemmas: 'list',
    occurrences: 'w[ref], lem[ref]',
};

// error ? FS
export function getLemListType(tagName): LemmatizedEntityType {
    return tagName.toLowerCase();
}

export function getLemListsToParseTagNames() {
    const neLemListsConfig = AppConfig.evtSettings.edition.lemmatizedEntitiesLists || {};

    return Object.keys(neLemListsConfig)
        .map((i) => neLemListsConfig[i].enabled ? lemmatizedEntitiesListsTagNamesMap[i] : undefined)
        .filter(ne => !!ne);
}

@xmlParser('evt-lemmatized-entities-list-parser', LemmatizedEntitiesListParser)
export class LemmatizedEntitiesListParser extends EmptyParser implements Parser<XMLElement> {
    private neLemListsConfig = AppConfig.evtSettings.edition.lemmatizedEntitiesLists || {};
    attributeParser = createParser(AttributeParser, this.genericParse);
    parse(xml: XMLElement): LemmatizedEntitiesList {
        const parsedLemList: LemmatizedEntitiesList = {
            type: LemmatizedEntitiesList,
            id: xml.getAttribute('xml:id') || xpath(xml),
            label: '',
            lemmatizedEntityType: getLemListType(xml.tagName),
            content: [],
            sublists: [],
            originalEncoding: xml,
            relations: [],
            description: [],
            attributes: this.attributeParser.parse(xml),
        };

        const relationParse = createParser(RelationParser, this.genericParse);
        xml.childNodes.forEach((child: XMLElement) => {
            if (child.nodeType === 1) {
                switch (child.tagName.toLowerCase()) {
                    case 'head':
                        parsedLemList.label = replaceNewLines(child.textContent);
                        break;
                    case 'desc':
                        parsedLemList.description.push(this.genericParse(child));
                        break;
                    case 'relation':
                        if (this.neLemListsConfig.relations.enabled) {
                            parsedLemList.relations.push(relationParse.parse(child));
                        }
                        break;
                    case 'listrelation':
                        if (this.neLemListsConfig.relations.enabled) {
                            child.querySelectorAll<XMLElement>('relation').forEach(r => parsedLemList.relations.push(relationParse.parse(r)));
                        }
                        break;
                    default:
                        if (getLemListsToParseTagNames().indexOf(child.tagName) >= 0) {
                            const subListParser = ParserRegister.get('evt-lemmatized-entities-list-parser');
                            const parsedSubList = subListParser.parse(child) as LemmatizedEntitiesList;
                            parsedLemList.sublists.push(parsedSubList);
                            parsedLemList.content = parsedLemList.content.concat(parsedSubList.content);
                            parsedLemList.relations = parsedLemList.relations.concat(parsedSubList.relations);
                        } else {
                            parsedLemList.content.push(this.genericParse(child) as LemmatizedEntity);
                        }
                }
            }
        });
        parsedLemList.label = parsedLemList.label || xml.getAttribute('type') || `List of ${parsedLemList.lemmatizedEntityType}`;

        return parsedLemList;
    }
}

@xmlParser('evt-lemmatized-entity-parser', LemmatizedEntityRefParser)
export class LemmatizedEntityRefParser extends EmptyParser implements Parser<XMLElement> {
    elementParser = createParser(GenericElemParser, this.genericParse);
    attributeParser = createParser(AttributeParser, this.genericParse);
    parse(xml: XMLElement): LemmatizedEntityRef | GenericElement {
        const ref = xml.getAttribute('ref');
        if (!ref) { return this.elementParser.parse(xml); }
        const neLemTypeMap: { [key: string]: LemmatizedEntityType } = {
            // add by FS - add here new tag for CPD
            w: 'w',
            lemmas: 'w',
            lem: 'lem',
            item: 'item'
        };

        return {
            type: LemmatizedEntityRef,
            entityLemId: getLemEntityID(ref),
            entityLemType: neLemTypeMap[xml.tagName],
            path: xpath(xml),
            content: parseChildren(xml, this.genericParse),
            attributes: this.attributeParser.parse(xml),
            class: xml.tagName.toLowerCase(),
        };
    }

}

// Generic entity parser
export class EntityParser extends EmptyParser implements Parser<XMLElement> {
    // TODO: try to refactor subclasses to use a function parameter to get labels
    attributeParsers = createParser(AttributeMapParser, this.genericParse);
    parse(xml: XMLElement): LemmatizedEntity {
        const elId = xml.getAttribute('xml:id') || xpath(xml);
        const label = replaceNewLines(xml.textContent) || 'No info';
        const entity: LemmatizedEntity = {
            type: LemmatizedEntity,
            id: elId,
            sortKey: xml.getAttribute('sortKey') || (label ? label[0] : '') || xml.getAttribute('xml:id') || xpath(xml),
            originalEncoding: xml,
            label,
            lemmatizedEntityType: this.getEntityType(xml.tagName),
            content: Array.from(xml.children).map((subchild: XMLElement) => this.parseEntityInfo(subchild)),
            attributes: this.attributeParsers.parse(xml),
        };

        return entity;
    }

    private parseEntityInfo(xml: XMLElement): LemmatizedEntityInfo {
        return {
            type: LemmatizedEntityInfo,
            label: xml.nodeType === 1 ? xml.tagName.toLowerCase() : 'info',
            content: [this.genericParse(xml)],
            attributes: xml.nodeType === 1 ? this.attributeParsers.parse(xml) : {},
        };
    }

    private getEntityType(tagName): LemmatizedEntityType { return tagName.toLowerCase(); }
}

@xmlParser('item', ItemParser)
export class ItemParser extends EntityParser {
    parse(xml: XMLElement): LemmatizedEntity {
        return {
            ...super.parse(xml),
            label: this.getLabel(xml),
        };
    }
// add by FS - add here new tag for CPD
    private getLabel(xml: XMLElement) { // TODO: refactor me, also try to use a function parameter for the label for each entity
        const itemElement = xml.querySelector<XMLElement>('item');
        const wElement = xml.querySelector<XMLElement>('w');
        const lemElement = xml.querySelector<XMLElement>('lem');
        let label: LemmatizedEntityLabel;
        if (itemElement) {
            label = replaceNewLines(itemElement.textContent);
        } else if (wElement) {
            label = wElement ? `${replaceNewLines(wElement.textContent)} ` : '';
        } else if (lemElement) {
            label = lemElement ? `${replaceNewLines(lemElement.textContent)} ` : '';
        }
        return label;
    }
}

export class EventParser extends EntityParser {
    parse(xml: XMLElement): LemmatizedEntity {
        return {
            ...super.parse(xml),
            label: textLabel('label', xml),
        };
    }

    getLabel(xml: XMLElement) {
        const eventLabelElement = xml.querySelector<XMLElement>('label');

        return (eventLabelElement ? replaceNewLines(eventLabelElement.textContent) : '') || 'No info';
    }
}

// @xmlParser('interpGrp', InterpGroupParser)
// export class InterpGroupParser) extends EntityParser {
//     parse(xml: XMLElement): LemmatizedEntity { return { ...super.parse(xml), label: this.getLabel(xml) }; }

//     private getLabel(xml: XMLElement) { // TODO: refactor me
//         const role = xml.getAttribute('xml:id');
//         let label: LemmatizedEntityLabel = 'No info';
//         if (role) {
//             label = role.trim();
//         } else {
//             label = replaceNewLines(xml.textContent) || 'No info';
//         }

//         return label;
//     }
// }

export class EntityInfoParser extends EmptyParser implements Parser<XMLElement> {
    attributeParsers = createParser(AttributeParser, this.genericParse);
    parse(xml: XMLElement): LemmatizedEntityInfo {
        return {
            type: LemmatizedEntityInfo,
            label: xml.nodeType === 1 ? xml.tagName.toLowerCase() : 'info',
            content: [this.genericParse(xml)],
            attributes: xml.nodeType === 1 ? this.attributeParsers.parse(xml) : {},
        };
    }
}

export class RelationParser extends EmptyParser implements Parser<XMLElement> {
    attributeParsers = createParser(AttributeParser, this.genericParse);
    entityInfoParser = createParser(EntityInfoParser, this.genericParse);
    textParser = createParser(TextParser, this.genericParse);

    parse(xml: XMLElement): Relation {
        const descriptionEls = xml.querySelectorAll<XMLElement>('desc');
        const attributes = this.attributeParsers.parse(xml);
        const { name, type } = attributes;
        const active = xml.getAttribute('active') || ''; // TODO: make get attributes return '' as default?
        const mutual = xml.getAttribute('mutual') || '';
        const passive = xml.getAttribute('passive') || '';

        const relation: Relation = {
            type: Relation,
            name,
            activeParts: active.replace(/#/g, '').split(' '), // TODO refactor to a single function
            mutualParts: mutual.replace(/#/g, '').split(' '),
            passiveParts: passive.replace(/#/g, '').split(' '),
            relationType: type,
            attributes,
            content: Array.from(xml.children).map((subchild: XMLElement) => this.entityInfoParser.parse(subchild)),
            description: [],
        };
        if (descriptionEls && descriptionEls.length > 0) {
            descriptionEls.forEach((el) => relation.description.push(this.genericParse(el)));
        } else {
            relation.description = [this.textParser.parse(xml)];
        }
        const parentListEl = xml.parentElement.tagName === 'listRelation' ? xml.parentElement : undefined;
        if (parentListEl) {
            relation.relationType = `${(parentListEl.getAttribute('type') || '')} ${(relation.relationType || '')}`.trim();
        }

        return relation;
    }
}

function getLemEntityID(ref: string) { return ref ? ref.replace(/#/g, '') : ''; }
function textLabel(elemName: string, xml: XMLElement) {
    const el = xml.querySelector<XMLElement>(elemName);
    return (el ? replaceNewLines(el.textContent) : '') || 'No info';
}
