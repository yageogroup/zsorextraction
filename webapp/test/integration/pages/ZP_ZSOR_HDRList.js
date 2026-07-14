sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'zsorextraction',
            componentId: 'ZP_ZSOR_HDRList',
            contextPath: '/ZP_ZSOR_HDR'
        },
        CustomPageDefinitions
    );
});