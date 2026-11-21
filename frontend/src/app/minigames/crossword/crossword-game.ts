import { A11yModule } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CrosswordEntry } from '../../core/study.models';
import {
  CrosswordCell,
  CrosswordDirection,
  CrosswordPlacement,
  generateCrossword,
  normalizeCrosswordWord,
  wordCells,
} from './crossword';

interface Coord {
  row: number;
  col: number;
}

const cellKey = (row: number, col: number) => `${row},${col}`;
const containsCell = (word: CrosswordPlacement, cell: Coord) =>
  word.direction === 'across'
    ? word.row === cell.row &&
      cell.col >= word.col &&
      cell.col < word.col + word.normalizedWord.length
    : word.col === cell.col &&
      cell.row >= word.row &&
      cell.row < word.row + word.normalizedWord.length;

const arrowMoves: Record<string, [number, number, CrosswordDirection]> = {
  ArrowUp: [-1, 0, 'down'],
  ArrowDown: [1, 0, 'down'],
  ArrowLeft: [0, -1, 'across'],
  ArrowRight: [0, 1, 'across'],
};

/** Crossword generated in the browser from the module words. It never changes official progress. */
@Component({
  selector: 'app-crossword-game',
  imports: [A11yModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './crossword-game.html',
  styleUrl: './crossword-game.css',
  host: {
    '(document:pointerdown)': 'closeRevealMenuOnOutsideClick($event)',
    '(document:keydown.escape)': 'closePopups()',
  },
})
export class CrosswordGame {
  readonly entries = input.required<CrosswordEntry[]>();
  readonly back = output();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly revealMenu = viewChild<ElementRef<HTMLElement>>('revealMenu');
  private readonly helpButton = viewChild<ElementRef<HTMLButtonElement>>('helpButton');
  private wasFocusedOnPointerDown = false;
  private wrongTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly grid = linkedSignal(() => generateCrossword(this.entries()));
  protected readonly letters = signal<Record<string, string>>({});
  protected readonly activeWordId = signal('');
  protected readonly focusedKey = signal('');
  protected readonly tooltipWordId = signal('');
  protected readonly solvedIds = signal(new Set<string>());
  protected readonly wrongWordId = signal('');
  protected readonly message = signal('');
  protected readonly revealedKeys = signal(new Set<string>());
  protected readonly revealedWordIds = signal(new Set<string>());
  protected readonly revealOpen = signal(false);
  protected readonly helpOpen = signal(false);

  protected readonly words = computed(() =>
    [...this.grid().words].sort(
      (a, b) => a.number - b.number || a.direction.localeCompare(b.direction),
    ),
  );
  protected readonly clueSections = computed(() => [
    { title: 'Horizontais', words: this.words().filter((word) => word.direction === 'across') },
    { title: 'Verticais', words: this.words().filter((word) => word.direction === 'down') },
  ]);
  private readonly wordById = computed(() => new Map(this.grid().words.map((w) => [w.id, w])));
  protected readonly activeWord = computed(() => this.wordById().get(this.activeWordId()));
  protected readonly displayedWord = computed(
    () =>
      this.activeWord() ??
      this.words().find((word) => !this.solvedIds().has(word.id)) ??
      this.words()[0],
  );
  protected readonly allSolved = computed(
    () => this.words().length > 0 && this.solvedIds().size === this.words().length,
  );

  constructor() {
    // Starts (and restarts after "Nova cruzadinha") with the first unsolved word selected.
    effect(() => {
      const displayed = this.displayedWord();
      if (!this.activeWordId() && displayed)
        untracked(() => this.selectWordById(displayed.id, false));
    });
    // Announces the selected clue and keeps it visible in the clue list.
    effect(() => {
      const word = this.activeWord();
      if (!word) return;
      const direction = word.direction === 'across' ? 'horizontal' : 'vertical';
      this.message.set(`Palavra ${word.number}, ${direction}: ${word.clue}`);
      this.host.nativeElement
        .querySelector(`[data-clue="${word.id}"]`)
        ?.scrollIntoView?.({ block: 'nearest' });
    });
    effect((onCleanup) => {
      if (!this.helpOpen()) return;
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      onCleanup(() => (document.body.style.overflow = previous));
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.wrongTimer));
  }

  protected key(cell: Coord): string {
    return cellKey(cell.row, cell.col);
  }

  /** Solved words and revealed letters can no longer be edited. */
  protected isLocked(cell: CrosswordCell): boolean {
    if (this.revealedKeys().has(this.key(cell))) return true;
    const solved = this.solvedIds();
    return [...cell.acrossWordIds, ...cell.downWordIds].some((id) => solved.has(id));
  }

  protected isWrong(cell: CrosswordCell, locked: boolean): boolean {
    const wrong = this.wrongWordId();
    return (
      !!wrong && !locked && (cell.acrossWordIds.includes(wrong) || cell.downWordIds.includes(wrong))
    );
  }

  protected isInActiveWord(cell: CrosswordCell): boolean | null {
    const word = this.activeWord();
    return word ? containsCell(word, cell) : null;
  }

  protected cellLabel(cell: CrosswordCell): string {
    const starts = cell.starts.length
      ? `, palavra ${cell.starts.map((item) => item.number).join(' e ')}`
      : '';
    return `Linha ${cell.row}, coluna ${cell.col}${starts}`;
  }

  protected hasSolvedStart(cell: CrosswordCell): boolean {
    return cell.starts.some((item) => this.solvedIds().has(item.id));
  }

  protected clueFor(id: string): string {
    return this.wordById().get(id)?.clue ?? '';
  }

  protected newCrossword(): void {
    this.grid.set(generateCrossword(this.entries()));
    this.letters.set({});
    this.activeWordId.set('');
    this.focusedKey.set('');
    this.tooltipWordId.set('');
    this.solvedIds.set(new Set());
    this.message.set('');
    this.revealedKeys.set(new Set());
    this.revealedWordIds.set(new Set());
  }

  private cellAt(coord: Coord): CrosswordCell | null {
    return this.grid().cells[coord.row]?.[coord.col] ?? null;
  }

  private isEditable(coord: Coord): boolean {
    const cell = this.cellAt(coord);
    return !!cell && !this.isLocked(cell);
  }

  private inputAt(coord: Coord): HTMLInputElement | null {
    return this.host.nativeElement.querySelector<HTMLInputElement>(
      `input[data-cell="${this.key(coord)}"]`,
    );
  }

  private focusInput(coord: Coord): void {
    this.focusedKey.set(this.key(coord));
    this.inputAt(coord)?.focus();
  }

  protected selectWordById(id: string, focus = true, targetCell?: Coord): void {
    let word = this.wordById().get(id);
    if (!word) return;
    let target = targetCell;
    // Clicking a locked cell of a solved word moves to the unsolved word that crosses it, if any.
    if (targetCell && !this.isEditable(targetCell)) {
      const cell = this.cellAt(targetCell);
      const currentId = word.id;
      const alternateId =
        cell &&
        [...cell.acrossWordIds, ...cell.downWordIds].find(
          (otherId) => otherId !== currentId && !this.solvedIds().has(otherId),
        );
      const alternate = alternateId ? this.wordById().get(alternateId) : undefined;
      if (alternate) {
        word = alternate;
        const coords = wordCells(word);
        target =
          coords.find((coord) => !this.letters()[this.key(coord)] && this.isEditable(coord)) ??
          coords.find((coord) => this.isEditable(coord)) ??
          coords[0];
      } else {
        const coords = wordCells(word);
        target = coords.find((coord) => this.isEditable(coord)) ?? coords[0];
      }
    }
    this.activeWordId.set(word.id);
    if (!target) {
      const coords = wordCells(word);
      target =
        coords.find((coord) => !this.letters()[this.key(coord)] && this.isEditable(coord)) ??
        coords[0];
    }
    this.focusedKey.set(this.key(target));
    if (focus) this.inputAt(target)?.focus();
  }

  /** Picks the word for a clicked cell; clicking the focused cell again switches direction. */
  protected selectAtCell(cell: CrosswordCell, toggle = false): void {
    const solved = this.solvedIds();
    const across = cell.acrossWordIds.find((id) => !solved.has(id));
    const down = cell.downWordIds.find((id) => !solved.has(id));
    const currentId = this.activeWordId();
    const startsHere = cell.starts.map((item) => item.id);
    let chosen = currentId === across || currentId === down ? currentId : (across ?? down);
    if (toggle && startsHere.length > 1 && this.focusedKey() === this.key(cell))
      chosen = startsHere.find((id) => id !== currentId && !solved.has(id)) ?? currentId;
    else if (toggle && across && down) chosen = currentId === across ? down : across;
    if (chosen) {
      this.selectWordById(chosen, true, cell);
      return;
    }
    const solvedId = [...cell.acrossWordIds, ...cell.downWordIds].find((id) =>
      this.wordById().has(id),
    );
    if (solvedId) this.selectWordById(solvedId, true, cell);
  }

  protected onCellPointerDown(cell: CrosswordCell): void {
    this.wasFocusedOnPointerDown = this.focusedKey() === this.key(cell);
  }

  protected onCellClick(cell: CrosswordCell): void {
    this.selectAtCell(cell, this.wasFocusedOnPointerDown);
  }

  protected onInputFocus(cell: CrosswordCell): void {
    this.focusedKey.set(this.key(cell));
    const word = this.activeWord();
    if (!word || !containsCell(word, cell)) this.selectAtCell(cell, false);
    else this.selectWordById(word.id, false, cell);
  }

  protected onNumberClick(event: MouseEvent, id: string, cell: CrosswordCell): void {
    event.stopPropagation();
    this.selectWordById(id, true, cell);
  }

  private focusCell(row: number, col: number, direction: CrosswordDirection): void {
    const cell = this.cellAt({ row, col });
    if (!cell) return;
    const solved = this.solvedIds();
    const ids = direction === 'across' ? cell.acrossWordIds : cell.downWordIds;
    const id = ids.find((word) => !solved.has(word));
    if (id) this.selectWordById(id, false);
    this.focusedKey.set(this.key(cell));
    if (!this.isLocked(cell)) this.inputAt(cell)?.focus();
    else this.selectAtCell(cell);
  }

  private focusNextEditable(word: CrosswordPlacement, fromIndex: number, step: number): void {
    const coords = wordCells(word);
    for (let index = fromIndex + step; index >= 0 && index < coords.length; index += step) {
      if (this.isEditable(coords[index])) {
        this.focusInput(coords[index]);
        return;
      }
    }
  }

  protected changeLetter(cell: CrosswordCell, event: Event): void {
    // Also clears the field when the typed character is dropped (a digit, for example).
    const letter = normalizeCrosswordWord((event.target as HTMLInputElement).value).slice(-1);
    this.setLetter(this.key(cell), letter);
    const word = this.activeWord();
    if (word && letter) {
      const index = wordCells(word).findIndex((c) => c.row === cell.row && c.col === cell.col);
      this.focusNextEditable(word, index, 1);
    }
  }

  protected onKeydown(event: KeyboardEvent, cell: CrosswordCell): void {
    const currentKey = this.key(cell);
    if (event.key === 'Enter') {
      event.preventDefault();
      this.checkWord();
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      if (this.isLocked(cell)) return;
      if (this.letters()[currentKey]) {
        this.setLetter(currentKey, '');
        this.focusInput(cell);
        return;
      }
      const word = this.activeWord();
      if (!word) return;
      const coords = wordCells(word);
      const index = coords.findIndex((c) => c.row === cell.row && c.col === cell.col);
      for (let previous = index - 1; previous >= 0; previous--) {
        if (!this.isEditable(coords[previous])) continue;
        this.setLetter(this.key(coords[previous]), '');
        this.focusInput(coords[previous]);
        break;
      }
    } else if (event.key === 'Delete') {
      event.preventDefault();
      if (!this.isLocked(cell)) this.setLetter(currentKey, '');
    } else if (arrowMoves[event.key]) {
      event.preventDefault();
      const [rowStep, colStep, direction] = arrowMoves[event.key];
      this.focusCell(cell.row + rowStep, cell.col + colStep, direction);
    }
  }

  private setLetter(key: string, letter: string): void {
    this.letters.update((current) => ({ ...current, [key]: letter }));
    // Writes to the field right away: until the next render, maxlength="1" would block the next key.
    const input = this.host.nativeElement.querySelector<HTMLInputElement>(
      `input[data-cell="${key}"]`,
    );
    if (input) input.value = letter;
  }

  private checkWord(): void {
    const word = this.activeWord();
    if (!word) return;
    const value = wordCells(word)
      .map((coord) => this.letters()[this.key(coord)] ?? '')
      .join('');
    if (value.length < word.normalizedWord.length) return;
    if (value === word.normalizedWord) {
      this.solvedIds.update((current) => new Set(current).add(word.id));
      this.wrongWordId.set('');
      this.message.set('Palavra correta');
      return;
    }
    this.wrongWordId.set(word.id);
    this.message.set('Palavra incorreta');
    clearTimeout(this.wrongTimer);
    this.wrongTimer = setTimeout(() => this.wrongWordId.set(''), 1500);
  }

  protected navigateWord(step: number): void {
    const words = this.words();
    if (!words.length) return;
    const currentId = this.activeWordId() || this.displayedWord()?.id;
    const index = Math.max(
      0,
      words.findIndex((word) => word.id === currentId),
    );
    this.selectWordById(words[(index + step + words.length) % words.length].id);
  }

  protected chooseReveal(action: 'cell' | 'word' | 'all'): void {
    this.revealOpen.set(false);
    if (action === 'cell') this.revealCell();
    else if (action === 'word') this.revealWord();
    else this.revealCrossword();
  }

  private revealCell(): void {
    const active = this.activeWord() ?? this.displayedWord();
    if (!active) return;
    const focused = this.focusedKey() ? this.focusedKey().split(',').map(Number) : null;
    const target =
      focused && this.cellAt({ row: focused[0], col: focused[1] })
        ? { row: focused[0], col: focused[1] }
        : wordCells(active).find((coord) => !this.letters()[this.key(coord)]);
    const cell = target && this.cellAt(target);
    if (!cell) return;
    const word = [...cell.acrossWordIds, ...cell.downWordIds]
      .map((id) => this.wordById().get(id))
      .find(Boolean);
    if (!word) return;
    const index = wordCells(word).findIndex((c) => c.row === cell.row && c.col === cell.col);
    const key = this.key(cell);
    this.setLetter(key, word.normalizedWord[index]);
    this.revealedKeys.update((current) => new Set(current).add(key));
    this.focusedKey.set(key);
    this.message.set('Célula revelada');
  }

  private revealWord(): void {
    const word = this.activeWord() ?? this.displayedWord();
    if (!word) return;
    const coords = wordCells(word);
    this.letters.update((current) => {
      const next = { ...current };
      coords.forEach((coord, index) => (next[this.key(coord)] = word.normalizedWord[index]));
      return next;
    });
    this.revealedKeys.update((current) => new Set([...current, ...coords.map((c) => this.key(c))]));
    this.revealedWordIds.update((current) => new Set(current).add(word.id));
    this.solvedIds.update((current) => new Set(current).add(word.id));
    this.message.set('Palavra revelada');
  }

  private revealCrossword(): void {
    if (!window.confirm('Revelar toda a cruzadinha?')) return;
    const letters: Record<string, string> = {};
    for (const word of this.words())
      wordCells(word).forEach(
        (coord, index) => (letters[this.key(coord)] = word.normalizedWord[index]),
      );
    const allIds = new Set(this.words().map((word) => word.id));
    this.letters.set(letters);
    this.revealedKeys.set(new Set(Object.keys(letters)));
    this.solvedIds.set(allIds);
    this.revealedWordIds.set(new Set(allIds));
    this.message.set('Cruzadinha concluída!');
  }

  protected closeRevealMenuOnOutsideClick(event: PointerEvent): void {
    if (this.revealOpen() && !this.revealMenu()?.nativeElement.contains(event.target as Node))
      this.revealOpen.set(false);
  }

  protected closePopups(): void {
    if (this.helpOpen()) this.closeHelp();
    this.revealOpen.set(false);
  }

  /** A click on the dark area around the dialog closes it. */
  protected onOverlayMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeHelp();
  }

  protected closeHelp(): void {
    this.helpOpen.set(false);
    this.helpButton()?.nativeElement.focus();
  }
}
