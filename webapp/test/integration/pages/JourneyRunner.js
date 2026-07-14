sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"zsorextraction/test/integration/pages/ZP_ZSOR_HDRList",
	"zsorextraction/test/integration/pages/ZP_ZSOR_HDRObjectPage",
	"zsorextraction/test/integration/pages/ZP_ZSOR_ITMObjectPage"
], function (JourneyRunner, ZP_ZSOR_HDRList, ZP_ZSOR_HDRObjectPage, ZP_ZSOR_ITMObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('zsorextraction') + '/test/flp.html#app-preview',
        pages: {
			onTheZP_ZSOR_HDRList: ZP_ZSOR_HDRList,
			onTheZP_ZSOR_HDRObjectPage: ZP_ZSOR_HDRObjectPage,
			onTheZP_ZSOR_ITMObjectPage: ZP_ZSOR_ITMObjectPage
        },
        async: true
    });

    return runner;
});

