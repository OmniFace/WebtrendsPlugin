// Name: webtrends.esBranding.js
// Description: Capture additional meta data on the DispForm.aspx pages of the Brand Assets and Branding PhotoLibrary preview pages.
// Author: Joel Merriman
// Created: 09/21/2018
// Created for: <Customer>
// Version: 1.01
//
// Example configuration:
//
//    plugin: {
//      esBranding: {																												// Property name must match first argument of Webtrends.registerPlugin() at bottom of this file
//          src: "/JavaScript/webtrends.esBranding.js",																			    // path to this plugin (Required) (String)
//          async: false,																											// Force the tag to wait for this plugin to load (Required) (Boolean)
//	        waitForCallback: true,																								    // Force the tag to also wait for the data on the page to be present before releasing (Required) (Boolean)
//          dispFormPages: "/sites/SiteCollection/Library1/Forms/DispForm.aspx,/sites/SiteCollection/Library1/Forms/DispForm.aspx",	// Comma delimited, case-insensitive list of pages to attempt collect this meta data on, based on indexOf match to current URL (Required) (String)
//	        charLimit: 100																											// Character limit of parameter value length, for things like the description which may be quite long (Optional) (Numeric or String)
//      }
//    }
//

// Function called by tag
var esBranding = function (tag, plugin) {

    // Register callback, but only once due to lack of check in webtrends.js file
    var registered = false;
    var register = function () {
        if (!registered) {
            registered = true;
            tag.registerPluginCallback("esBranding");
        }
    };

    try {
        // Set internal variables
        var pages = plugin.dispFormPages ? plugin.dispFormPages.toLowerCase().split(",") : false;
        var charLimit = plugin.charLimit ? parseInt(plugin.charLimit) : 100;
        var metaObject = {};

        // Check if the plugin should make the tag wait
        if (pages) {
            var delay = false;
            var loc = window.location.pathname.toLowerCase();
            for (var i = 0; i < pages.length; i++) {
                if (loc.indexOf(pages[i]) >= 0) {
                    delay = true;
                    break;
                }
            }
            if (!delay) {
                register();
                return;
            }
        } else {
            register();
            return;
        }

        // Delay the tag on pages that we should wait
        var waitForReady = setInterval(function () {
            if (document.readyState === "complete") {
                clearInterval(waitForReady);
                register();
            }
        }, 100);

        // Collect all meta data and store as parameter value list
        var collectData = function () {
            // Collect the proper WPQ # for the global variable in case it changes
            var wpqNumEl = document.querySelector("div[id$='ClientFormPlaceholder']");
            if (wpqNumEl) {
                // Extract the desired prefix from an element id, reference the variable where the data is stored e.g. id="WPQ2ClientFormPlaceholder" and window.WPQ2FormCtx
                var wpqPrefix = wpqNumEl.id.substring(0, 4);
                var FormCtx = window[wpqPrefix + "FormCtx"];
                if (FormCtx) {
                    var ListData = FormCtx.ListData;
                    // Iterate throught the object collecting desired meta data
                    for (var prop in ListData) {
                        if (ListData.hasOwnProperty(prop)) {
                            var propName = prop.replace("x0020_", "").toLowerCase();
                            var propValue = ListData[prop];
                            // Only keep properties with valid string values
                            if (propValue && typeof propValue === "string") {
                                // Clean up author/editor data
                                if (propValue.indexOf("#i:0#.w|accounts\\") >= 0) {
                                    var valueArr = propValue.split(/;#|,#/);
                                    for (var i = 0; i < valueArr.length; i++) {
                                        if ((/^[\D]+/).exec(valueArr[i])) {
                                            propValue = valueArr[i];
                                            break;
                                        }
                                    }
                                }
                                metaObject[propName] = propValue.replace(/<[^>]+>/g, "").replace(/^\s+|\s+$/g, "");  // Remove HTML from string and trim
                            }
                        }
                    }
                } else {
                    metaObject.meta_error = "webtrends.esBranding.js - 'window." + wpqPrefix + "FormCtx' object not found.  Cannot collect meta data.";
                }
            }
        };

        // Push stored meta data into hits, or clear the same parameters from unwanted link click hits such as a navigation menu
        var pushData = function (multiTrackObject, clear) {
            for (var item in metaObject) {
                if (metaObject.hasOwnProperty(item)) {
                    // Retrieve property names from stored list
                    var name = item;
                    // Retrieve property values, or clear them
                    var value = clear ? "" : metaObject[item];
                    // Truncate long values to a user set limit
                    if (value.length > charLimit) {
                        value = value.substring(0, charLimit);
                        value = value.substring(0, value.lastIndexOf(" ")) + "...";
                    }
                    // Push the data into the hit
                    multiTrackObject.argsa.push("WT.shp_doc_" + name, value);
                }
            }
        };

        // Retrieve and add the meta data to the Page View events
        Webtrends.addTransform(function (dcsObject, multiTrackObject) {
            try {
                // Populate the stored list
                collectData();
                // Add the stored data to the hit
                pushData(multiTrackObject, false);
            } catch (err) { }
        }, "collect");

        // Add the meta data Link Clicks on the "Download Asset" link Only, and clear stuck parameter values on other links
        Webtrends.addTransform(function (dcsObject, multiTrackObject) {
            try {
                var el = multiTrackObject.element;
                var text = (el.innerText || el.textContent).replace(/^\s+|\s+$/g, "");
                if ((el && el.className === "aDownload") || text.toLowerCase() === "download asset") {
                    // Download Asset link, add the stored data to the hit
                    pushData(multiTrackObject, false);
                } else {
                    // Other link, clear the stuck data from the hit
                    pushData(multiTrackObject, true);
                }
            } catch (err) { }
        }, "multitrack");
    } catch (err) {
        // Release the tag if something went wrong loading initializing the plugin
        register();
    }
};
// Register the plugin with the tag, to run it
Webtrends.registerPlugin("esBranding", esBranding);
