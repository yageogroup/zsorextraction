sap.ui.define([
    "sap/m/MessageToast"
], function (MessageToast) {
    "use strict";

    var bSplitActive = false;
    var OBJECT_PAGE_ID = "zsorextraction::ZP_ZSOR_HDRObjectPage--fe::ObjectPage";

    // ── Store original styles for perfect restore ────────────────
    var oSavedStyles = {
        parent: {},
        domRef: {}
    };

    var IMAGE_SERVICE =
        "/sap/opu/odata4/sap/zui_zsor_req/srvd/sap/zsd_zsor_req/0001/" +
        "ZI_ZSOR_SRCIMG";

    var FLDINFO_SERVICE =
        "/sap/opu/odata4/sap/zui_zsor_req/srvd/sap/zsd_zsor_req/0001/" +
        "ZI_ZSOR_FLDINFO";

    // ── Cleanup registry — populated on openSplit, flushed on closeSplit ──
    var _fnHashChange    = null;
    var _fnRouteMatched  = null;
    var _oRouter         = null;

    // ============================================================
    // FIELD HIGHLIGHTS — handled via CSS class gr-split-active
    // Added to body on openSplit, removed on closeSplit
    // All highlight rules are in webapp/css/style.css
    // ============================================================

    // ── Fetch page count ─────────────────────────────────────────
    function fetchPageCount(sSorKey, fnCallback) {
        var sUrl = IMAGE_SERVICE +
            "?$filter=Sor eq '" + sSorKey + "'" +
            "&$select=Pgnum" +
            "&$format=json";

        fetch(sUrl, { credentials: "include" })
            .then(function (res) { return res.json(); })
            .then(function (oData) {
                var aRows = oData.value || [];
                var iMax  = 1;
                aRows.forEach(function (oRow) {
                    var iPage = parseInt(oRow.Pgnum, 10);
                    if (!isNaN(iPage) && iPage > iMax) { iMax = iPage; }
                });
                fnCallback(null, aRows.length > 0 ? iMax : 1);
            })
            .catch(function (err) { fnCallback(err, 1); });
    }

    // ── Fetch image as base64 and return data URI ────────────────
    function fetchImageAsDataUri(sSorKey, iPage, fnCallback) {
        var sUrl = IMAGE_SERVICE +
            "(Sor='" + encodeURIComponent(sSorKey) + "'" +
            ",Pgnum=" + iPage + ")" +
            "?$select=Imgcontent,Mimetype" +
            "&$format=json";

        fetch(sUrl, { credentials: "include" })
            .then(function (res) { return res.json(); })
            .then(function (oData) {
                var sMime   = oData.Mimetype   || "image/jpeg";
                var sBase64 = oData.Imgcontent || "";

                if (!sBase64) {
                    fnCallback(new Error("No image content"), null);
                    return;
                }

                sBase64 = sBase64
                    .replace(/-/g, "+")
                    .replace(/_/g, "/");

                var iPad = sBase64.length % 4;
                if (iPad === 2)      { sBase64 += "=="; }
                else if (iPad === 3) { sBase64 += "=";  }

                fnCallback(null, "data:" + sMime + ";base64," + sBase64);
            })
            .catch(function (err) { fnCallback(err, null); });
    }

    // ── Fetch fields for a specific page ─────────────────────────
    function fetchFieldsFromOData(sSorKey, iPageNumber, fnCallback) {
        var sUrl = FLDINFO_SERVICE +
            "?$filter=Sor eq '" + sSorKey + "'" +
            " and Slsordreqsourceimagepagenumber eq " + iPageNumber +
            "&$format=json";

        fetch(sUrl, { credentials: "include" })
            .then(function (res) { return res.json(); })
            .then(function (oData) { fnCallback(null, oData.value || []); })
            .catch(function (err) { fnCallback(err, []); });
    }

    function formatFieldName(sName) {
        if (!sName) { return ""; }
        return sName
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, function (s) { return s.toUpperCase(); })
            .trim();
    }

    function getImageDisplayRect(oImage, oWrapper) {
        var imgRect     = oImage.getBoundingClientRect();
        var wrapperRect = oWrapper.getBoundingClientRect();
        if (!imgRect.width || !imgRect.height) { return null; }
        return {
            left:   (imgRect.left - wrapperRect.left) + oWrapper.scrollLeft,
            top:    (imgRect.top  - wrapperRect.top)  + oWrapper.scrollTop,
            width:  imgRect.width,
            height: imgRect.height
        };
    }

    function drawHighlightsOverImage(aFields, oImage, oImageWrapper, bShowHeaderLabels, bShowItemLabels) {
        var oExisting = oImageWrapper.querySelector("#doxHighlightLayer");
        if (oExisting) { oExisting.remove(); }

        var oRect = getImageDisplayRect(oImage, oImageWrapper);
        if (!oRect) { return; }

        var oLayer = document.createElement("div");
        oLayer.id = "doxHighlightLayer";
        oLayer.style.cssText =
            "position:absolute;" +
            "left:"   + oRect.left   + "px;" +
            "top:"    + oRect.top    + "px;" +
            "width:"  + oRect.width  + "px;" +
            "height:" + oRect.height + "px;" +
            "pointer-events:none;z-index:10;overflow:visible;";

        aFields.forEach(function (oField) {
            var x = parseFloat(oField.Fieldhorizontalaxisvalue);
            var y = parseFloat(oField.Fieldverticalaxisvalue);
            var w = parseFloat(oField.Fieldboundingboxwidthvalue);
            var h = parseFloat(oField.Fieldboundingboxheightvalue);

            if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h) ||
                x < 0 || x > 1 || y < 0 || y > 1 || w <= 0 || h <= 0) { return; }

            var bIsHeader = parseInt(oField.Extracteditemindex, 10) === 0;
            var sColor    = bIsHeader ? "rgba(0,112,177," : "rgba(255,140,0,";

            var oBox = document.createElement("div");
            oBox.style.cssText =
                "position:absolute;" +
                "left:"   + (x * 100) + "%;" +
                "top:"    + (y * 100) + "%;" +
                "width:"  + (w * 100) + "%;" +
                "height:" + Math.max(h * 100, 0.8) + "%;" +
                "background:" + sColor + "0.20);" +
                "border:1.5px solid " + sColor + "0.85);" +
                "border-radius:2px;box-sizing:border-box;";

            var sFieldName  = formatFieldName(oField.Extractedfieldname);
            var sFieldValue = oField.Extractedfieldvalue || "";
            oBox.title = sFieldName + ": " + sFieldValue;

            var bShowLabel = bIsHeader ? bShowHeaderLabels : bShowItemLabels;
            if (bShowLabel) {
                var oLabel = document.createElement("div");
                oLabel.textContent = sFieldName;
                oLabel.style.cssText =
                    "position:absolute;left:0;top:-12px;" +
                    "background:" + sColor + "0.95);" +
                    "color:#fff;font-size:8px;line-height:10px;" +
                    "padding:0px 3px;border-radius:2px;white-space:nowrap;" +
                    "max-width:max-content;box-shadow:0 1px 2px rgba(0,0,0,0.35);" +
                    "pointer-events:none;z-index:11;";
                oBox.appendChild(oLabel);
            }
            oLayer.appendChild(oBox);
        });
        oImageWrapper.appendChild(oLayer);
    }

    // ── Save element styles before modifying ────────────────────
    function saveStyles(oEl, aProps) {
        var oSaved = {};
        aProps.forEach(function (p) {
            oSaved[p] = oEl.style[p] || "";
        });
        return oSaved;
    }

    // ── Restore saved styles exactly ────────────────────────────
    function restoreStyles(oEl, oSaved) {
        Object.keys(oSaved).forEach(function (p) {
            oEl.style[p] = oSaved[p];
        });
    }

    // ── Detach all navigation listeners registered during openSplit ──
    function _detachNavListeners() {
        if (_fnHashChange) {
            window.removeEventListener("hashchange", _fnHashChange);
            _fnHashChange = null;
        }
        if (_fnRouteMatched && _oRouter) {
            try { _oRouter.detachRouteMatched(_fnRouteMatched); } catch (e) { /* ignore */ }
            _fnRouteMatched = null;
            _oRouter        = null;
        }
    }

    // ============================================================
    // OPEN SPLIT
    // ============================================================
    function openSplit(oPage, oBindingContext) {

        var oDomRef = oPage.getDomRef();
        if (!oDomRef) { MessageToast.show("DOM not found."); return; }

        var sKey = oBindingContext
            ? oBindingContext.getProperty("Sor")
            : "";

        if (!sKey) {
            MessageToast.show("No SOR key found.");
            return;
        }

        var oParentDom = oDomRef.parentElement;
        var aParentProps = ["display","flexDirection","width","height","overflow"];
        var aDomProps    = ["flexBasis","flexGrow","flexShrink","minWidth","width","height","overflowY","overflow"];

        // ── Save originals before touching anything ──────────────
        oSavedStyles.parent = saveStyles(oParentDom, aParentProps);
        oSavedStyles.domRef = saveStyles(oDomRef,    aDomProps);

        // ── Apply split layout ───────────────────────────────────
        oParentDom.style.display       = "flex";
        oParentDom.style.flexDirection = "row";
        oParentDom.style.width         = "100%";
        oParentDom.style.height        = "calc(100vh - 3rem)";
        oParentDom.style.overflow      = "hidden";

        oDomRef.style.flexBasis  = "55%";
        oDomRef.style.flexGrow   = "0";
        oDomRef.style.flexShrink = "0";
        oDomRef.style.minWidth   = "300px";
        oDomRef.style.height     = "100%";
        oDomRef.style.overflowY  = "auto";
        oDomRef.style.overflow   = "auto";

        // Splitter bar
        var oSplitter = document.createElement("div");
        oSplitter.id               = "splitterBar";
        oSplitter.style.width      = "10px";
        oSplitter.style.cursor     = "col-resize";
        oSplitter.style.background = "#b0b0b0";
        oSplitter.style.flexShrink = "0";
        oSplitter.style.height     = "100%";
        oSplitter.style.zIndex     = "9999";

        // Right panel
        var oRightDiv = document.createElement("div");
        oRightDiv.id                  = "splitRightPanel";
        oRightDiv.style.flex          = "1";
        oRightDiv.style.minWidth      = "300px";
        oRightDiv.style.height        = "100%";
        oRightDiv.style.display       = "flex";
        oRightDiv.style.flexDirection = "column";
        oRightDiv.style.borderLeft    = "1px solid #ccc";
        oRightDiv.style.boxSizing     = "border-box";
        oRightDiv.style.overflow      = "hidden";

        // Header bar
        var oHeader = document.createElement("div");
        oHeader.style.cssText =
            "display:flex;align-items:center;justify-content:space-between;" +
            "padding:8px 16px;background:#f7f7f7;border-bottom:1px solid #ccc;" +
            "flex-shrink:0;gap:12px;";
        oHeader.innerHTML =
            '<span style="font-weight:bold;font-size:15px;">Source File</span>' +
            '<span style="font-size:12px;display:flex;gap:12px;align-items:center;flex:1;justify-content:flex-end;">' +
            '<span id="legendHeaderToggle" style="cursor:pointer;padding:2px 6px;border-radius:3px;border:1px solid transparent;user-select:none;">' +
            '<span style="display:inline-block;width:12px;height:12px;background:rgba(0,112,177,0.3);border:1.5px solid #0070b1;border-radius:2px;margin-right:4px;vertical-align:middle;"></span>Header</span>' +
            '<span id="legendItemToggle" style="cursor:pointer;padding:2px 6px;border-radius:3px;border:1px solid transparent;user-select:none;">' +
            '<span style="display:inline-block;width:12px;height:12px;background:rgba(255,140,0,0.3);border:1.5px solid orange;border-radius:2px;margin-right:4px;vertical-align:middle;"></span>Line Items</span>' +
            '<span id="pageNavContainer" style="display:flex;align-items:center;gap:4px;">' +
            '<button id="pagePrevBtn" style="cursor:pointer;border:1px solid #ccc;background:#fff;border-radius:3px;width:20px;height:22px;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;">&#8249;</button>' +
            '<select id="pageSelect" style="font-size:12px;height:22px;border:1px solid #ccc;border-radius:3px;background:#fff;padding:0 2px;"></select>' +
            '<span id="pageTotalLabel" style="font-size:12px;color:#555;">/ 1</span>' +
            '<button id="pageNextBtn" style="cursor:pointer;border:1px solid #ccc;background:#fff;border-radius:3px;width:20px;height:22px;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;">&#8250;</button>' +
            '</span></span>' +
            '<button id="splitCloseBtn" style="cursor:pointer;border:none;background:none;font-size:20px;">✕</button>';

        // Image wrapper
        var oImageWrapper = document.createElement("div");
        oImageWrapper.id            = "imageContainerWrapper";
        oImageWrapper.style.cssText =
            "position:relative;flex:1;overflow:auto;background:#888;" +
            "display:flex;align-items:flex-start;justify-content:flex-start;";

        // ── Image element — always starts clean ──────────────────
        var oImage = document.createElement("img");
        oImage.id            = "grSourceImage";
        oImage.style.cssText = "display:none;width:100%;height:auto;";
        oImage.src           = "";

        var oLoadingText = document.createElement("span");
        oLoadingText.id             = "imageLoadingText";
        oLoadingText.style.color    = "#eee";
        oLoadingText.style.fontSize = "14px";
        oLoadingText.style.padding  = "16px";
        oLoadingText.textContent    = "Loading image...";

        oImageWrapper.appendChild(oLoadingText);
        oImageWrapper.appendChild(oImage);
        oRightDiv.appendChild(oHeader);
        oRightDiv.appendChild(oImageWrapper);
        oParentDom.appendChild(oSplitter);
        oParentDom.appendChild(oRightDiv);

        // ── Label toggle state ───────────────────────────────────
        var aCachedFields     = [];
        var bShowHeaderLabels = false;
        var bShowItemLabels   = false;

        var oHeaderToggle = oHeader.querySelector("#legendHeaderToggle");
        var oItemToggle   = oHeader.querySelector("#legendItemToggle");

        function updateToggleStyles() {
            oHeaderToggle.style.background  = bShowHeaderLabels ? "rgba(0,112,177,0.15)"  : "transparent";
            oHeaderToggle.style.borderColor = bShowHeaderLabels ? "#0070b1"    : "transparent";
            oItemToggle.style.background    = bShowItemLabels   ? "rgba(255,140,0,0.15)" : "transparent";
            oItemToggle.style.borderColor   = bShowItemLabels   ? "orange"     : "transparent";
        }

        function redraw() {
            drawHighlightsOverImage(aCachedFields, oImage, oImageWrapper, bShowHeaderLabels, bShowItemLabels);
        }

        oHeaderToggle.addEventListener("click", function () {
            bShowHeaderLabels = !bShowHeaderLabels;
            updateToggleStyles();
            redraw();
        });
        oItemToggle.addEventListener("click", function () {
            bShowItemLabels = !bShowItemLabels;
            updateToggleStyles();
            redraw();
        });

        updateToggleStyles();

        // ── Resize / scroll listeners — tracked for cleanup ──────
        var oResizeObserver = null;

        window.addEventListener("resize", redraw);
        oImageWrapper.addEventListener("scroll", redraw);
        if (window.ResizeObserver) {
            oResizeObserver = new ResizeObserver(redraw);
            oResizeObserver.observe(oImageWrapper);
        }

        // Store cleanup fn on the panel so closeSplit can call it
        oRightDiv._cleanup = function () {
            window.removeEventListener("resize", redraw);
            if (oResizeObserver) {
                oResizeObserver.disconnect();
                oResizeObserver = null;
            }
        };

        // ── Page navigator ───────────────────────────────────────
        var oPrevBtn    = oHeader.querySelector("#pagePrevBtn");
        var oNextBtn    = oHeader.querySelector("#pageNextBtn");
        var oPageSelect = oHeader.querySelector("#pageSelect");
        var oTotalLabel = oHeader.querySelector("#pageTotalLabel");

        var iCurrentPage = 1;
        var iTotalPages  = 1;

        function updateNavButtons() {
            oPrevBtn.disabled      = (iCurrentPage <= 1);
            oNextBtn.disabled      = (iCurrentPage >= iTotalPages);
            oPrevBtn.style.opacity = oPrevBtn.disabled ? "0.4" : "1";
            oNextBtn.style.opacity = oNextBtn.disabled ? "0.4" : "1";
            oPrevBtn.style.cursor  = oPrevBtn.disabled ? "default" : "pointer";
            oNextBtn.style.cursor  = oNextBtn.disabled ? "default" : "pointer";
            oPageSelect.disabled   = (iTotalPages <= 1);
        }

        function loadFieldsForPage(iPage) {
            fetchFieldsFromOData(sKey, iPage, function (err, aFields) {
                aCachedFields = (!err) ? aFields : [];
                redraw();
            });
        }

        function goToPage(iPage) {
            if (iPage < 1 || iPage > iTotalPages) { return; }
            iCurrentPage      = iPage;
            oPageSelect.value = String(iPage);

            // ── Always reset before loading new page ─────────────
            oImage.src                 = "";
            oImage.style.display       = "none";
            oLoadingText.style.display = "";
            oLoadingText.textContent   = "Loading image...";
            aCachedFields              = [];

            // Remove any stale highlight layer immediately
            var oStale = oImageWrapper.querySelector("#doxHighlightLayer");
            if (oStale) { oStale.remove(); }

            updateNavButtons();

            fetchImageAsDataUri(sKey, iCurrentPage, function (err, sDataUri) {
                if (err || !sDataUri) {
                    oLoadingText.textContent = "No image found.";
                    return;
                }
                oImage.onload = function () {
                    oLoadingText.style.display = "none";
                    oImage.style.display       = "block";
                    redraw();
                };
                oImage.onerror = function () {
                    oLoadingText.textContent = "Image failed to render.";
                };
                oImage.src = sDataUri;
            });

            loadFieldsForPage(iCurrentPage);
        }

        oPrevBtn.addEventListener("click", function () { goToPage(iCurrentPage - 1); });
        oNextBtn.addEventListener("click", function () { goToPage(iCurrentPage + 1); });
        oPageSelect.addEventListener("change", function () {
            goToPage(parseInt(oPageSelect.value, 10));
        });

        fetchPageCount(sKey, function (err, iCount) {
            iTotalPages = err ? 1 : iCount;
            oPageSelect.innerHTML = "";
            for (var i = 1; i <= iTotalPages; i++) {
                var oOpt = document.createElement("option");
                oOpt.value = oOpt.textContent = String(i);
                oPageSelect.appendChild(oOpt);
            }
            oTotalLabel.textContent = "/ " + iTotalPages;
            goToPage(1);
        });

        // ── Splitter drag ────────────────────────────────────────
        var isDragging = false, pendingWidth = null, animFrame = null;

        oSplitter.addEventListener("mouseenter", function () {
            if (!isDragging) { oSplitter.style.background = "#666"; }
        });
        oSplitter.addEventListener("mouseleave", function () {
            if (!isDragging) { oSplitter.style.background = "#b0b0b0"; }
        });
        oSplitter.addEventListener("mousedown", function () {
            isDragging = true;
            document.body.style.cursor     = "col-resize";
            document.body.style.userSelect = "none";
            oSplitter.style.background     = "#444";
        });
        document.addEventListener("mousemove", function (e) {
            if (!isDragging) { return; }
            var parentRect = oParentDom.getBoundingClientRect();
            var leftWidth  = Math.min(
                Math.max(e.clientX - parentRect.left, 300),
                parentRect.width - 300
            );
            pendingWidth = leftWidth;
            if (!animFrame) {
                animFrame = requestAnimationFrame(function () {
                    oDomRef.style.flexBasis = pendingWidth + "px";
                    animFrame = null;
                    redraw();
                });
            }
        });
        document.addEventListener("mouseup", function () {
            if (!isDragging) { return; }
            isDragging = false;
            document.body.style.cursor     = "";
            document.body.style.userSelect = "";
            oSplitter.style.background     = "#666";
            redraw();
        });

        oHeader.querySelector("#splitCloseBtn")
            .addEventListener("click", function () { closeSplit(oPage); });

        bSplitActive = true;

        // ── Activate CSS highlights ──────────────────────────────
        document.body.classList.add("gr-split-active");

        // ── Auto-close on back navigation (hash change) ──────────
        _detachNavListeners(); // clear any leftover from a previous open

        _fnHashChange = function () {
            if (bSplitActive) {
                closeSplit(oPage);
            }
            _detachNavListeners();
        };
        window.addEventListener("hashchange", _fnHashChange);

        // ── Auto-close via UI5 router (covers non-hash routing) ──
        try {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(oPage);
            if (oRouter) {
                _oRouter = oRouter;
                _fnRouteMatched = function () {
                    if (bSplitActive) {
                        closeSplit(oPage);
                    }
                    _detachNavListeners();
                };
                _oRouter.attachRouteMatched(_fnRouteMatched);
            }
        } catch (e) { /* router not available in this context */ }
    }

    // ============================================================
    // CLOSE SPLIT
    // ============================================================
    function closeSplit(oPage) {

        var oDomRef = oPage.getDomRef();
        if (!oDomRef) { return; }

        var oParentDom = oDomRef.parentElement;

        // ── Deactivate CSS highlights ────────────────────────────
        document.body.classList.remove("gr-split-active");

        // ── Detach back-navigation listeners ────────────────────
        _detachNavListeners();

        // ── Cleanup resize/scroll listeners via stored fn ────────
        var oRightDiv = document.getElementById("splitRightPanel");
        if (oRightDiv) {
            if (typeof oRightDiv._cleanup === "function") {
                oRightDiv._cleanup();
            }
            oRightDiv.remove();
        }

        // ── Remove splitter bar ──────────────────────────────────
        var oSplitter = document.getElementById("splitterBar");
        if (oSplitter) { oSplitter.remove(); }

        // ── Restore EXACTLY what was there before ────────────────
        restoreStyles(oParentDom, oSavedStyles.parent);
        restoreStyles(oDomRef,    oSavedStyles.domRef);

        // ── Restore body/doc scroll ──────────────────────────────
        document.body.style.overflow            = "";
        document.documentElement.style.overflow = "";

        // ── Force UI5 to recalculate layout ─────────────────────
        setTimeout(function () {
            window.dispatchEvent(new Event("resize"));
            if (oPage && oPage.invalidate) {
                oPage.invalidate();
            }
        }, 50);

        bSplitActive = false;
    }

    // ============================================================
    return {
        viewfilehandler: function (oContext) {

            var oPage = sap.ui.getCore().byId(OBJECT_PAGE_ID);
            if (!oPage) { MessageToast.show("Object Page not found"); return; }

            var oBindingContext = oContext
                ? (oContext.getBindingContext
                    ? oContext.getBindingContext()
                    : oContext)
                : null;

            if (bSplitActive) {
                closeSplit(oPage);
            } else {
                openSplit(oPage, oBindingContext);
            }
        }
    };
});