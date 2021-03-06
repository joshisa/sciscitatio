H5P.TrueFalse = (function ($, Question) {
  'use strict';

  // Maximum score for True False
  var MAX_SCORE = 1;

  /**
   * Enum containing the different states this content type can exist in
   *
   * @enum
   */
  var State = Object.freeze({
    ONGOING: 1,
    FINISHED_WRONG: 2,
    FINISHED_CORRECT: 3,
    INTERNAL_SOLUTION: 4,
    EXTERNAL_SOLUTION: 5
  });

  /**
   * Button IDs
   */
  var Button = Object.freeze({
    CHECK: 'check-answer',
    TRYAGAIN: 'try-again',
    SHOW_SOLUTION: 'show-solution'
  });

  /**
   * Initialize module.
   *
   * @class H5P.TrueFalse
   * @extends H5P.Question
   * @param {Object} options
   * @param {number} id Content identification
   * @param {Object} contentData Task specific content data
   */
  function TrueFalse(options, id, contentData) {
    var self = this;

    // Inheritance
    Question.call(self, 'true-false');

    var params = $.extend(true, {
      question: 'No question text provided',
      correct: 'true',
      l10n: {
        trueText: 'True',
        falseText: 'False',
        score: 'You got @score of @total points',
        checkAnswer: 'Check',
        showSolutionButton: 'Show solution',
        tryAgain: 'Retry',
        wrongAnswerMessage: 'Wrong answer',
        correctAnswerMessage: 'Correct answer'
      },
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        disableImageZooming: false,
        confirmCheckDialog: false,
        confirmRetryDialog: false,
        autoCheck: false
      },
      overrideSettings: {}
    }, options);

    // Counter used to create unique id for this question
    TrueFalse.counter = (TrueFalse.counter === undefined ? 0 : TrueFalse.counter + 1);

    // A unique ID is needed for aria label
    var domId = 'h5p-tfq' + H5P.TrueFalse.counter;

    // The radio group
    var answerGroup = new H5P.TrueFalse.AnswerGroup(domId, params.correct, params.l10n);
    if (contentData.previousState !== undefined && contentData.previousState.answer !== undefined) {
      answerGroup.check(contentData.previousState.answer);
    }
    answerGroup.on('selected', function () {
      self.triggerXAPI('interacted');

      if (params.behaviour.autoCheck) {
        checkAnswer();
      }
    });


    /**
     * Create the answers
     *
     * @method createAnswers
     * @private
     * @return {H5P.jQuery}
     */
    var createAnswers = function () {
      return answerGroup.getDomElement();
    };

    /**
     * Register buttons
     *
     * @method registerButtons
     * @private
     */
    var registerButtons = function () {
      // Show solution button
      if (params.behaviour.enableSolutionsButton === true) {
        self.addButton(Button.SHOW_SOLUTION, params.l10n.showSolutionButton, function () {
          self.showSolutions(true);
        }, false);
      }

      // Check button
      if (!params.behaviour.autoCheck) {
        self.addButton(Button.CHECK, params.l10n.checkAnswer, function () {
          checkAnswer();
        }, true, {}, {
          confirmationDialog: {
            enable: params.behaviour.confirmCheckDialog,
            l10n: params.confirmCheck,
            instance: params.overrideSettings.instance,
            $parentElement: params.overrideSettings.$confirmationDialogParent
          }
        });
      }

      // Try again button
      if (params.behaviour.enableRetry === true) {
        self.addButton(Button.TRYAGAIN, params.l10n.tryAgain, function () {
          self.resetTask();
        }, true, {}, {
          confirmationDialog: {
            enable: params.behaviour.confirmRetryDialog,
            l10n: params.confirmRetry,
            instance: params.overrideSettings.instance,
            $parentElement: params.overrideSettings.$confirmationDialogParent
          }
        });
      }

      toggleButtonState(State.ONGOING);
    };

    /**
     * Creates and triggers the xAPI answered event
     *
     * @method triggerXAPIAnswered
     * @private
     * @fires xAPIEvent
     */
    var triggerXAPIAnswered = function () {
      var xAPIEvent = self.createXAPIEventTemplate('answered');
      addQuestionToXAPI(xAPIEvent);
      addResponseToXAPI(xAPIEvent);
      self.trigger(xAPIEvent);
    };

    /**
     * Add the question itself to the definition part of an xAPIEvent
     *
     * @method addQuestionToXAPI
     * @param {XAPIEvent} xAPIEvent
     * @private
     */
    var addQuestionToXAPI = function(xAPIEvent) {
      var definition = xAPIEvent.getVerifiedStatementValue(['object', 'definition']);
      definition.description = {
        // Remove tags, must wrap in div tag because jQuery 1.9 will crash if the string isn't wrapped in a tag.
        'en-US': $('<div>' + params.question + '</div>').text()
      };
      definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
      definition.interactionType = 'true-false';
      definition.correctResponsesPattern = [getCorrectAnswer()];
    };

    /**
     * Returns the correct answer
     *
     * @method getCorrectAnswer
     * @private
     * @return {String}
     */
    var getCorrectAnswer = function () {
      return (params.correct === 'true' ? params.l10n.trueText : params.l10n.falseText);
    };

    /**
     * Returns the wrong answer
     *
     * @method getWrongAnswer
     * @private
     * @return {String}
     */
    var getWrongAnswer = function () {
      return (params.correct === 'false' ? params.l10n.trueText : params.l10n.falseText);
    };

    /**
     * Add the response part to an xAPI event
     *
     * @method addResponseToXAPI
     * @private
     * @param {H5P.XAPIEvent} xAPIEvent
     *  The xAPI event we will add a response to
     */
    var addResponseToXAPI = function(xAPIEvent) {
      var isCorrect = answerGroup.isCorrect();
      xAPIEvent.setScoredResult(isCorrect ? MAX_SCORE : 0, MAX_SCORE, self, true, isCorrect);
      xAPIEvent.data.statement.result.response = (isCorrect ? getCorrectAnswer() : getWrongAnswer());
    };

    /**
     * Toggles btton visibility dependent of current state
     *
     * @method toggleButtonVisibility
     * @private
     * @param  {String}    buttonId
     * @param  {Boolean}   visible
     */
    var toggleButtonVisibility = function (buttonId, visible) {
      if (visible === true) {
        self.showButton(buttonId);
      }
      else {
        self.hideButton(buttonId);
      }
    };

    /**
     * Toggles buttons state
     *
     * @method toggleButtonState
     * @private
     * @param  {String}          state
     */
    var toggleButtonState = function (state) {
      toggleButtonVisibility(Button.SHOW_SOLUTION, state === State.FINISHED_WRONG);
      toggleButtonVisibility(Button.CHECK, state === State.ONGOING);
      toggleButtonVisibility(Button.TRYAGAIN, state === State.FINISHED_WRONG || state === State.INTERNAL_SOLUTION);
    };

    /**
     * Check if answer is correct or wrong, and update visuals accordingly
     *
     * @method checkAnswer
     * @private
     */
    var checkAnswer = function () {
      // Create feedback widget
      var score = self.getScore();
      var scoreText;

      toggleButtonState(score === MAX_SCORE ? State.FINISHED_CORRECT : State.FINISHED_WRONG);

      if (score === MAX_SCORE && params.behaviour.feedbackOnCorrect) {
        scoreText = params.behaviour.feedbackOnCorrect;
      }
      else if (score === 0 && params.behaviour.feedbackOnWrong) {
        scoreText = params.behaviour.feedbackOnWrong;
      }
      else {
        scoreText = params.l10n.score;
      }
      // Replace relevant variables:
      scoreText = scoreText.replace('@score', score).replace('@total', MAX_SCORE);
      self.setFeedback(scoreText, score, MAX_SCORE);
      answerGroup.reveal();
      triggerXAPIAnswered();
    };

    /**
     * Registers this question type's DOM elements before they are attached.
     * Called from H5P.Question.
     *
     * @method registerDomElements
     * @private
     */
    self.registerDomElements = function () {
      var self = this;

      // Check for task media
      var media = params.media;
      if (media && media.library) {
        var type = media.library.split(' ')[0];
        if (type === 'H5P.Image') {
          if (media.params.file) {
            // Register task image
            self.setImage(media.params.file.path, {
              disableImageZooming: params.behaviour.disableImageZooming,
              alt: media.params.alt
            });
          }
        }
        else if (type === 'H5P.Video') {
          if (media.params.sources) {
            // Register task video
            self.setVideo(media);
          }
        }
      }

      // Add task question text
      self.setIntroduction('<div id="' + domId + '">' + params.question + '</div>');

      // Register task content area
      self.setContent(createAnswers());

      // ... and buttons
      registerButtons();
    };

    /**
     * Implements resume (save content state)
     *
     * @method getCurrentState
     * @public
     * @returns {object} object containing answer
     */
    self.getCurrentState = function () {
      return {answer: answerGroup.getAnswer()};
    };

    /**
     * Used for contracts.
     * Checks if the parent program can proceed. Always true.
     *
     * @method getAnswerGiven
     * @public
     * @returns {Boolean} true
     */
    self.getAnswerGiven = function () {
      return answerGroup.hasAnswered();
    };

    /**
     * Used for contracts.
     * Checks the current score for this task.
     *
     * @method getScore
     * @public
     * @returns {Number} The current score.
     */
    self.getScore = function () {
      return answerGroup.isCorrect() ? MAX_SCORE : 0;
    };

    /**
     * Used for contracts.
     * Checks the maximum score for this task.
     *
     * @method getMaxScore
     * @public
     * @returns {Number} The maximum score.
     */
    self.getMaxScore = function () {
      return MAX_SCORE;
    };

    /**
     * Get title of task
     *
     * @method getTitle
     * @upblic
     * @returns {string} title
     */
    self.getTitle = function () {
      return H5P.createTitle(params.question);
    };

    /**
     * Used for contracts.
     * Show the solution.
     *
     * @method showSolutions
     * @public
     */
    self.showSolutions = function (internal) {
      checkAnswer();
      answerGroup.showSolution();
      toggleButtonState(internal ? State.INTERNAL_SOLUTION : State.EXTERNAL_SOLUTION);
    };

    /**
     * Used for contracts.
     * Resets the complete task back to its' initial state.
     *
     * @method resetTask
     * @public
     */
    self.resetTask = function () {
      answerGroup.reset();
      self.setFeedback();
      toggleButtonState(State.ONGOING);
    };

    /**
     * Get xAPI data.
     * Contract used by report rendering engine.
     *
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
     */
    self.getXAPIData = function(){
      var xAPIEvent = this.createXAPIEventTemplate('answered');
      this.addQuestionToXAPI(xAPIEvent);
      this.addResponseToXAPI(xAPIEvent);
      return {
        statement: xAPIEvent.data.statement
      }
    };

    /**
     * Add the question itself to the definition part of an xAPIEvent
     */
    self.addQuestionToXAPI = function(xAPIEvent) {
      var definition = xAPIEvent.getVerifiedStatementValue(['object', 'definition']);
      $.extend(definition, this.getxAPIDefinition());
    };

    /**
     * Generate xAPI object definition used in xAPI statements.
     * @return {Object}
     */
    self.getxAPIDefinition = function () {
      var definition = {};
      definition.interactionType = 'true-false';
      definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
      definition.description = {
        'en-US': $('<div>' + params.question + '</div>').text()
      };
      definition.correctResponsesPattern = [getCorrectAnswer()];

      return definition;
    };

    /**
     * Add the response part to an xAPI event
     *
     * @param {H5P.XAPIEvent} xAPIEvent
     *  The xAPI event we will add a response to
     */
    self.addResponseToXAPI = function (xAPIEvent) {
      var isCorrect = answerGroup.isCorrect();
      var rawUserScore = isCorrect ? MAX_SCORE : 0;
      var currentResponse = '';

      xAPIEvent.setScoredResult(rawUserScore, MAX_SCORE, self, true, isCorrect);

      if(self.getCurrentState().answer !== undefined) {
        currentResponse += answerGroup.isCorrect() ? getCorrectAnswer() : getWrongAnswer();
      }
      xAPIEvent.data.statement.result.response = currentResponse;
    };
   }

  // Inheritance
  TrueFalse.prototype = Object.create(Question.prototype);
  TrueFalse.prototype.constructor = TrueFalse;

  return TrueFalse;
})(H5P.jQuery, H5P.Question);
