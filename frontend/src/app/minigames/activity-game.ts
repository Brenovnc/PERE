import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ActivityAnswer, StudyActivity } from '../core/study.models';
import { ExposureGame } from './exposure-game';
import { FillBlankGame } from './fill-blank-game';
import { GuessConceptGame } from './guess-concept-game';
import { OrderingGame } from './ordering-game';
import { TrueFalseGame } from './true-false-game';

/** Shows the minigame that matches the activity type. */
@Component({
  selector: 'app-activity-game',
  imports: [ExposureGame, TrueFalseGame, FillBlankGame, GuessConceptGame, OrderingGame],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let current = activity();
    @switch (current.type) {
      @case ('EXPOSURE') {
        <app-exposure-game
          [activity]="current"
          [disabled]="busy()"
          (reveal)="reveal.emit()"
          (answered)="answered.emit($event)"
        />
      }
      @case ('TRUE_FALSE') {
        <app-true-false-game
          [activity]="current"
          [disabled]="busy()"
          (answered)="answered.emit($event)"
        />
      }
      @case ('FILL_BLANK') {
        <app-fill-blank-game
          [activity]="current"
          [disabled]="busy()"
          (answered)="answered.emit($event)"
        />
      }
      @case ('GUESS_CONCEPT') {
        <app-guess-concept-game
          [activity]="current"
          [disabled]="busy()"
          (reveal)="reveal.emit()"
          (answered)="answered.emit($event)"
        />
      }
      @case ('ORDERING') {
        <app-ordering-game
          [activity]="current"
          [disabled]="busy()"
          (answered)="answered.emit($event)"
        />
      }
    }
  `,
})
export class ActivityGame {
  readonly activity = input.required<StudyActivity>();
  readonly busy = input(false);
  readonly reveal = output();
  readonly answered = output<ActivityAnswer>();
}
