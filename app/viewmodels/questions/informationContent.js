﻿define(['modules/questionsNavigation', 'plugins/router'], function (navigationModule, router) {
    "use strict";

    var viewModel = {
        title: null,
        learningContents: null,

        navigateNext: navigateNext,
        navigateNextText: navigateNextText,

        activate: activate
    };

    return viewModel;

    function navigateNext() {
        var nextUrl = !_.isNullOrUndefined(viewModel.navigationContext.nextQuestionUrl) ? viewModel.navigationContext.nextQuestionUrl : 'objectives';
        router.navigate(nextUrl);
    }

    function navigateNextText() {
        return !_.isNullOrUndefined(viewModel.navigationContext.nextQuestionUrl) ? 'Next' : 'Home';
    }

    function activate(objectiveId, question) {
        return Q.fcall(function () {
            viewModel.navigationContext = navigationModule.getNavigationContext(objectiveId, question.id);

            viewModel.title = question.title;
            viewModel.learningContents = question.learningContents;
        });
    }

});