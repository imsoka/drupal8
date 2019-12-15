/**
 * @file
 * Handles AJAX login and register events.
 */

(function ($, Drupal, drupalSettings) {

    'use strict';

	/**
	 * @type {{attach: Drupal.behaviors.gigyaRassDynamicSession.attach}}
	 *
	 * @property drupalSettings.gigyaExtra.session_type
	 */
	Drupal.behaviors.gigyaRassDynamicSession = {
		attach: function (context, settings) {
            if ("dynamic" === drupalSettings.gigyaExtra.session_type) {
				Drupal.ajax({url: drupalSettings.path.baseUrl + 'gigya/extcookie'}).execute();
            }
        }
    };

	/* For Internet Explorer */
	if (!String.prototype.startsWith) {
		String.prototype.startsWith = function (searchString, position) {
			position = position || 0;
			return this.indexOf(searchString, position) === position;
		};
	}

	/**
	 * Invoked using InvokeCommand by Drupal's controller
	 *
	 * @param redirectTarget
	 *
	 * @property gigya.setSSOToken
	 */
	jQuery.fn.loginRedirect = function (redirectTarget) {
		/**
		 * @var bool sendSetSSOToken	Should be set in Gigya's global configuration.
		 * 								Set this to True if you would like setSSOToken to be called
		 * 								(a redirect to Gigya to set the site's cookies, for browsers that do not support 3rd party cookies)
		 */

		if (!redirectTarget.startsWith('http'))
			redirectTarget = window.location.origin + drupalSettings.path.baseUrl + redirectTarget;

		if (typeof sendSetSSOToken === 'undefined' || sendSetSSOToken === false)
			location.replace(redirectTarget);
		else if (sendSetSSOToken === true)
			gigya.setSSOToken({redirectURL: redirectTarget});
	};

	jQuery.fn.logoutRedirect = function (redirectTarget) {
		if (!redirectTarget.startsWith('http'))
			redirectTarget = window.location.origin + drupalSettings.path.baseUrl + redirectTarget;

		document.location = redirectTarget;
	};

	/**
	 * @property drupalSettings.gigya.loginUIParams
	 * @property gigya.services.socialize.showLoginUI
	 */
    var initLoginUI = function () {
        if (typeof drupalSettings.gigya.loginUIParams !== 'undefined') {
            $.each(drupalSettings.gigya.loginUIParams, function (index, value) {
                value.context = {id: value.containerID};
                gigya.services.socialize.showLoginUI(value);
            });
        }
    };

    var onLoginHandler = function (res) {
        var data = {
            "uid": res.UID,
            "uid_sig": res.UIDSignature,
            "sig_timestamp": res.signatureTimestamp
        };

        var ajaxSettings = {
            url: drupalSettings.path.baseUrl + 'gigya/raas-login',
            submit: data
        };

        var myAjaxObject = Drupal.ajax(ajaxSettings);
        myAjaxObject.execute();
    };

    var profileUpdated = function (data) {
		if (data.response.errorCode === 0) {
            var gigyaData = {
                UID: data.response.UID,
                UIDSignature: data.response.UIDSignature,
                signatureTimestamp: data.response.signatureTimestamp
            };

            var ajaxSettings = {
                url: drupalSettings.path.baseUrl + 'gigya/raas-profile-update',
				submit: {gigyaData: gigyaData}
            };

            var myAjaxObject = Drupal.ajax(ajaxSettings);
            myAjaxObject.execute();
        }
    };

    var checkLogout = function () {
        var logoutCookie = gigya.utils.cookie.get('Drupal.visitor.gigya');
		    if (logoutCookie === 'gigyaLogOut') {
            gigya.accounts.logout();
            gigya.utils.cookie.remove('Drupal.visitor.gigya');
        }
    };

	/**
	 * @property drupalSettings.path.baseUrl
	 * @property myAjaxObject.execute()
	 */
	var onLogoutHandler = function () {
		var data = {};

		var ajaxSettings = {
			url: drupalSettings.path.baseUrl + 'gigya/raas-logout',
			submit: data
		};
		var myAjaxObject = Drupal.ajax(ajaxSettings);
		myAjaxObject.execute();
    };

	var registerGigyaEventMap = function() {
		gigya.events.addMap({
			defaultMethod: function (rememberMe) {
				var data = {
					"remember_me_status": rememberMe
				};

				var ajaxSettings = {
					url: drupalSettings.path.baseUrl + 'gigya/raas-validatesession',
					submit: data
				};

				var rememberMeAjaxObject = Drupal.ajax(ajaxSettings);
				rememberMeAjaxObject.execute();
			},
			eventMap: [{events: 'submit', args: ['${formModel.profile.remember}']}]
		});
	};

	/**
	 * @property gigya.accounts.showScreenSet
	 * @property drupalSettings.gigya.enableRaaS
	 * @property drupalSettings.gigya.raas
	 * @property drupalSettings.gigya.raas.login
	 */
    var initRaaS = function () {
        if (drupalSettings.gigya.enableRaaS) {
        	registerGigyaEventMap();

            var id;
            $('.gigya-raas-login').once('gigya-raas').click(function (e) {
                e.preventDefault();
                gigya.accounts.showScreenSet(drupalSettings.gigya.raas.login);
                drupalSettings.gigya.raas.linkId = $(this).attr('id');
            });
            $('.gigya-raas-reg').once('gigya-raas').click(function (e) {
                e.preventDefault();
                gigya.accounts.showScreenSet(drupalSettings.gigya.raas.register);
                drupalSettings.gigya.raas.linkId = $(this).attr('id');
            });
            $('.gigya-raas-prof, a[href="/user"]').once('gigya-raas').click(function (e) {
                e.preventDefault();
                drupalSettings.gigya.raas.profile.onAfterSubmit = profileUpdated;
                gigya.accounts.showScreenSet(drupalSettings.gigya.raas.profile);
            });
            var loginDiv = $('#gigya-raas-login-div');
            if (loginDiv.length > 0 && (typeof drupalSettings.gigya.raas.login !== 'undefined')) {
				id = loginDiv.eq(0).attr('id');
                drupalSettings.gigya.raas.login.containerID = id;
                drupalSettings.gigya.raas.linkId = id;
                gigya.accounts.showScreenSet(drupalSettings.gigya.raas.login);
            }
            var regDiv = $('#gigya-raas-register-div');
            if (regDiv.length > 0 && (typeof drupalSettings.gigya.raas.register !== 'undefined')) {
				id = regDiv.eq(0).attr('id');
                drupalSettings.gigya.raas.register.containerID = id;
                drupalSettings.gigya.raas.linkId = id;
                gigya.accounts.showScreenSet(drupalSettings.gigya.raas.register);
            }
            var profDiv = $('#gigya-raas-profile-div');
            if ((profDiv.length > 0) && (typeof drupalSettings.gigya.raas.profile !== 'undefined')) {
                drupalSettings.gigya.raas.profile.containerID = profDiv.eq(0).attr('id');
                drupalSettings.gigya.raas.profile.onAfterSubmit = profileUpdated;
                gigya.accounts.showScreenSet(drupalSettings.gigya.raas.profile);
            }
        }
    };

	/**
	 * @property gigya.accounts.showScreenSet
	 * @property drupalSettings.gigya.raas.customScreenSets
	 */
	var initCustomScreenSet = function () {
		if (drupalSettings.gigya.enableRaaS) {
			var customScreenSets = drupalSettings.gigya.raas.customScreenSets;

			/**
			 * @property custom_screenset.display_type
			 * @property custom_screenset.link_id
			 * @property custom_screenset.container_id
			 * @property custom_screenset.desktop_screenset
			 * @property custom_screenset.mobile_screenset
			 * @property custom_screenset.sync_data
			 */
			customScreenSets.forEach(function (custom_screenset) {
				if (typeof custom_screenset.display_type !== 'undefined') {
					var screenset_params = {
						screenSet: custom_screenset.desktop_screenset,
						mobileScreenSet: custom_screenset.mobile_screenset
					};
					if (parseInt(custom_screenset.sync_data) === 1)
						screenset_params['onAfterSubmit'] = processFieldMapping;

					if (custom_screenset.display_type === 'popup') {
						$('#' + custom_screenset.link_id).once('gigya-raas').click(function (e) {
							e.preventDefault();
							gigya.accounts.showScreenSet(screenset_params);
							drupalSettings.gigya.raas.linkId = $(this).attr('id');
						});
					} else if (custom_screenset.display_type === 'embed') {
						screenset_params['containerID'] = custom_screenset.container_id;
						gigya.accounts.showScreenSet(screenset_params);
					}
				}
			});
		}
	};

	var processFieldMapping = function (data) {
		var gigyaData = {
			UID: data.response.UID,
			UIDSignature: data.response.UIDSignature,
			signatureTimestamp: data.response.signatureTimestamp
		};
		var ajaxSettings = {
			url: drupalSettings.path.baseUrl + 'gigya/raas-process-fieldmapping',
			submit: {gigyaData: gigyaData}
		};
		var myAjaxObject = Drupal.ajax(ajaxSettings);
		myAjaxObject.execute();
	};

    var init = function () {
        if (drupalSettings.gigya.enableRaaS) {
            gigyaHelper.addGigyaFunctionCall('accounts.addEventHandlers', {
                onLogin: onLoginHandler,
                onLogout: onLogoutHandler
            });
        }

        drupalSettings.gigya.isRaasInit = true;
    };

	/**
	 * @type {{attach: Drupal.behaviors.gigyaRaasInit.attach}}
	 *
	 * @param context
	 * @param settings
	 *
	 * @property Drupal.behaviors
	 */
	Drupal.behaviors.gigyaRaasInit = {
        attach: function (context, settings) {
            if (!('isRaasInit' in drupalSettings.gigya)) {
				/**
				 * @param serviceName
				 */
				window.onGigyaServiceReady = function (serviceName) {
                    checkLogout();
                    gigyaHelper.runGigyaCmsInit();
                    initLoginUI();
                    initRaaS();
					initCustomScreenSet();
                };
                init();
            }
        }
    };

})(jQuery, Drupal, drupalSettings);