import { Component, ElementRef, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, Subject, Subscription } from 'rxjs';
import { delay, distinctUntilChanged, filter, map, shareReplay, take } from 'rxjs/operators';
import { AppConfig, EditionLevel, EditionLevelType, TextFlow } from '../../app.config';
import { EntitiesSelectItem } from '../../components/entities-select/entities-select.component';
import { LemsSelectItem } from '../../components/lems-select/lems-select.component';
import { IperlemsSelectItem } from '../../components/iperlems-select/iperlems-select.component';
import { Page } from '../../models/evt-models';
import { EVTModelService } from '../../services/evt-model.service';
import { EVTStatusService } from '../../services/evt-status.service';
import { EvtIconInfo } from '../../ui-components/icon/icon.component';

@Component({
  selector: 'evt-text-panel',
  templateUrl: './text-panel.component.html',
  styleUrls: ['./text-panel.component.scss'],
})
export class TextPanelComponent implements OnInit, OnDestroy {
  @ViewChild('mainContent') mainContent: ElementRef;

  @Input() hideEditionLevelSelector: boolean;

  @Input() pageID: string;
  public currentPage$ = new BehaviorSubject<Page>(undefined);
  public currentPageId$ = this.currentPage$.pipe(
    map(p => p?.id),
  );
  @Output() pageChange: Observable<Page> = this.currentPage$.pipe(
    filter(p => !!p),
    distinctUntilChanged(),
  );

  @Input() editionLevelID: EditionLevelType;
  public currentEdLevel$ = new BehaviorSubject<EditionLevel>(undefined);
  public currentEdLevelId$ = this.currentEdLevel$.pipe(
    map(e => e?.id),
  );
  @Output() editionLevelChange: Observable<EditionLevel> = this.currentEdLevel$.pipe(
    filter(e => !!e),
    distinctUntilChanged(),
  );

  public currentStatus$ = combineLatest([
    this.evtModelService.pages$,
    this.currentPage$,
    this.currentEdLevel$,
    this.evtStatus.currentViewMode$,
  ]).pipe(
    delay(0),
    filter(([pages, currentPage, editionLevel, currentViewMode]) => !!pages && !!currentPage && !!editionLevel && !!currentViewMode),
    map(([pages, currentPage, editionLevel, currentViewMode]) => ({ pages, currentPage, editionLevel, currentViewMode })),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    shareReplay(1),
  );

  public itemsToHighlight$ = new Subject<EntitiesSelectItem[]>();
  public itemsLemsToHighlight$ = new Subject<LemsSelectItem[]>();
  public itemsIperlemsToHighlight$ = new Subject<IperlemsSelectItem[]>();
  public secondaryContent = '';
  private showSecondaryContent = false;

  public selectedPage;

  public textFlow: TextFlow = AppConfig.evtSettings.edition.defaultTextFlow || 'prose';
  public enableProseVersesToggler = AppConfig.evtSettings.edition.proseVersesToggler;
  public get proseVersesTogglerIcon(): EvtIconInfo {

    return { icon: this.textFlow === 'prose' ? 'align-left' : 'align-justify', iconSet: 'fas' };
  }

  public isMultiplePageFlow$ = this.currentStatus$.pipe(
    map((x) => x.editionLevel.id === 'critical' && x.currentViewMode.id !== 'imageText'),
    shareReplay(1),
  );

  private updatingPageFromScroll = false;
  private subscriptions: Subscription[] = [];

  constructor(
    public evtModelService: EVTModelService,
    public evtStatus: EVTStatusService,
  ) {
  }

  ngOnInit() {
    if (this.editionLevelID === 'critical') {
      this.textFlow = AppConfig.evtSettings.edition.defaultTextFlow || 'verses';
    }
    if (!this.enableProseVersesToggler) {
      this.textFlow = undefined;
    }

    this.subscriptions.push(
      this.currentStatus$.pipe(
        map(currentStatus => currentStatus.currentPage),
        filter(page => !!page),
        delay(0), // Needed to have the HTML pb el available
      ).subscribe((page) => this._scrollToPage(page.id)),
    );
  }

  getSecondaryContent(): string {
    return this.secondaryContent;
  }

  isSecondaryContentOpened(): boolean {
    return this.showSecondaryContent;
  }

  toggleSecondaryContent(newContent: string) {
    if (this.secondaryContent !== newContent) {
      this.showSecondaryContent = true;
      this.secondaryContent = newContent;
    }
    else {
      this.showSecondaryContent = false;
      this.secondaryContent = '';
    }
  }

  toggleProseVerses() {
    this.textFlow = this.textFlow === 'prose' ? 'verses' : 'prose';
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  updatePage() {
    if (this.mainContent && this.editionLevelID === 'critical') {
      const mainContentEl: HTMLElement = this.mainContent.nativeElement;
      const pbs = mainContentEl.querySelectorAll('evt-page');
      let pbCount = 0;
      let pbVisible = false;
      let pbId = '';
      const docViewTop = mainContentEl.scrollTop;
      const docViewBottom = docViewTop + mainContentEl.parentElement.clientHeight;
      while (pbCount < pbs.length && !pbVisible) {
        pbId = pbs[pbCount].getAttribute('data-id');
        const pbElem = mainContentEl.querySelector<HTMLElement>(`evt-page[data-id="${pbId}"]`);
        const pbRect = pbElem.getBoundingClientRect();
        if (pbRect.top && (pbRect.top <= docViewBottom) && (pbRect.top >= docViewTop)) {
          pbVisible = true;
        } else {
          pbCount++;
        }
      }
      combineLatest([this.evtModelService.pages$, this.currentPageId$])
        .pipe(take(1)).subscribe(([pages, currentPageId]) => {
          if (pbVisible && currentPageId !== pbId) {
            this.updatingPageFromScroll = true;
            this.evtStatus.updatePage$.next(pages.find(p => p.id === pbId));
          }
        });
    }
  }

  private _scrollToPage(pageId: string) {
    if (this.updatingPageFromScroll) {
      this.updatingPageFromScroll = false;
    } else if (this.mainContent) {
      const mainContentEl: HTMLElement = this.mainContent.nativeElement;
      const pageEl = mainContentEl.querySelector<HTMLElement>(`[data-id="${pageId}"]`);
      if (pageEl) {
        pageEl.scrollIntoView();
      } else {
        mainContentEl.parentElement.scrollTop = 0;
      }
    }
  }
}
