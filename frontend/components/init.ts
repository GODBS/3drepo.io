export const TDR = () => {

	if (window) {
		let maintenanceMode = false;

		if (!window.ClientConfig) {
			console.error("ClientConfig has not been provided...");
			return;
		} else {

			if (window.ClientConfig && window.ClientConfig.maintenanceMode === true) {
				document.getElementById("maintenanceMode").style.display = "block";
				maintenanceMode = true;
			}

			if (window.ClientConfig.VERSION) {
				/* tslint:disable */
				console.log(`===== 3D REPO - Version ${window.ClientConfig.VERSION} =====`);
				/* tslint:enable */
			} else {
				console.error("No version number in config...");
			}

			if (window.ClientConfig.unitySettings) {
				// Assign unity settings
				window.Module = ClientConfig.unitySettings;

			} else {
				console.error("ClientConfig does not have any provided Unity settings!");
			}
		}

		if (!maintenanceMode) {

			if (angular) {
				window.TDR = angular.module("3drepo", ["ui.router", "ngMaterial", "ngAnimate", "ngSanitize", "vcRecaptcha"]);
			}

		}

	}

};
