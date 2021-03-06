/**
 **  Copyright (C) 2014 3D Repo Ltd
 **
 **  This program is free software: you can redistribute it and/or modify
 **  it under the terms of the GNU Affero General Public License as
 **  published by the Free Software Foundation, either version 3 of the
 **  License, or (at your option) any later version.
 **
 **  This program is distributed in the hope that it will be useful,
 **  but WITHOUT ANY WARRANTY; without even the implied warranty of
 **  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 **  GNU Affero General Public License for more details.
 **
 **  You should have received a copy of the GNU Affero General Public License
 **  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 **/
declare var Module;
declare var SendMessage;
declare var UnityLoader;

export class UnityUtil {

	public static errorCallback: any;
	public static viewer: any;

	public static LoadingState = {
		VIEWER_READY : 1,  // Viewer has been loaded
		MODEL_LOADING : 2, // model information has been fetched, world offset determined, model starts loading
		MODEL_LOADED : 3 // Models
	};

	public static unityInstance;

	public static readyPromise;
	public static readyResolve;

	public static loadedPromise;
	public static loadedResolve;

	public static loadingPromise;
	public static loadingResolve;

	// Diff promises
	public static loadComparatorResolve;
	public static loadComparatorPromise;

	public static unityHasErrored = false;

	public static screenshotPromises = [];
	public static vpPromise = null;
	public static objectStatusPromise = null;
	public static loadedFlag = false;
	public static UNITY_GAME_OBJECT = "WebGLInterface";
	public static defaultHighlightColor = [1, 1, 0];

	public static init(
		errorCallback: any
	) {
		UnityUtil.errorCallback = errorCallback;
	}

	public static onProgress(gameInstance, progress: number) {

		const appendTo = "viewer";

		if (!gameInstance.progress) {
			gameInstance.progress = document.createElement("div");
			gameInstance.progress.className = "unityProgressBar";
			document.getElementById(appendTo).appendChild(gameInstance.progress);
		}

		requestAnimationFrame(() => {
			if (progress === 1) {
				gameInstance.progress.style.width = 0;
				gameInstance.progress.style.display = "none";
			} else {
				const width = document.body.clientWidth * (progress);
				gameInstance.progress.style.width = width + "px";
			}
		});

	}

	public static loadUnity(divId: any, unityJsonPath?: string) {

		unityJsonPath = unityJsonPath || "unity/Build/unity.json";

		const unitySettings: any = {
			onProgress: this.onProgress
		};
		UnityLoader.Error.handler = this.onUnityError;
		if (window && (window as any).Module) {
			unitySettings.Module = (window as any).Module;
			UnityUtil.unityInstance = UnityLoader.instantiate(
				divId,
				unityJsonPath,
				unitySettings
			);
		} else {
			UnityUtil.unityInstance = UnityLoader.instantiate(
				divId,
				unityJsonPath
			);
		}

	}

	/**
	 * Cancel the loading of model.
	 */
	public static cancelLoadModel() {
		if (!UnityUtil.loadedFlag && UnityUtil.loadedResolve) {
			// If the previous model is being loaded but hasn't finished yet
			UnityUtil.loadedResolve.reject("cancel");
		}

		if (UnityUtil.loadingResolve) {
			UnityUtil.loadingResolve.reject("cancel");
		}
	}

	/**
	 * Check if an error is Unity related
	 */
	public static isUnityError(err) {
		const checks = [
			"Array buffer allocation failed", "Invalid typed array length",
			"Unity", "unity", "emscripten", "blob:http"
		];
		const hasUnityError = !checks.every((check) => err.indexOf(check) === -1);
		return hasUnityError;
	}

	/**
	 * Handle a error from Unity
	 */
	public static onUnityError(errorObject) {

		const err = errorObject.message;
		const line = errorObject.lineno;
		let reload = false;
		let conf;

		if (UnityUtil.isUnityError(err)) {
			reload = true;
			conf = `Your browser has failed to load 3D Repo's model viewer. The following occured:
					<br><br> <code>Error ${err} occured at line ${line}</code>
					<br><br>  This may due to insufficient memory. Please ensure you are using a modern 64bit web browser
					(such as Chrome or Firefox), reduce your memory usage and try again.
					If you are unable to resolve this problem, please contact support@3drepo.org referencing the above error.
					<br><md-container>`;
		} else {
			conf = `Something went wrong :( <br><br> <code>Error ${err} occured at line ${line}</code><br><br>
				If you are unable to resolve this problem, please contact support@3drepo.org referencing the above error
				<br><br> Click OK to refresh this page<md-container>`;
		}

		const isUnityError = reload;

		UnityUtil.userAlert(conf, reload, isUnityError);

		return true;
	}

	public static onLoaded() {
		if (!UnityUtil.loadedPromise) {
			UnityUtil.loadedPromise = new Promise((resolve, reject) => {
				UnityUtil.loadedResolve = {resolve, reject};
			});
		}
		return UnityUtil.loadedPromise;

	}

	public static onLoading() {
		if (!UnityUtil.loadingPromise) {
			UnityUtil.loadingPromise = new Promise((resolve, reject) => {
				UnityUtil.loadingResolve = {resolve, reject};
			});
		}
		return UnityUtil.loadingPromise;

	}

	public static onReady() {

		if (!UnityUtil.readyPromise) {
			UnityUtil.readyPromise	= new Promise((resolve, reject) => {
				UnityUtil.readyResolve = {resolve, reject};
			});
		}

		return UnityUtil.readyPromise;

	}

	public static userAlert(message, reload, isUnity) {

		if (!UnityUtil.unityHasErrored) {

			// Unity can error multiple times, we don't want
			// to keep annoying the user
			UnityUtil.unityHasErrored = true;
			UnityUtil.errorCallback(message, reload, isUnity);
		}

	}

	public static toUnity(methodName, requireStatus, params) {

		if (requireStatus === UnityUtil.LoadingState.MODEL_LOADED) {
			// Requires model to be loaded
			UnityUtil.onLoaded().then(() => {
				if (UnityUtil.unityInstance) {
					UnityUtil.unityInstance.SendMessage(UnityUtil.UNITY_GAME_OBJECT, methodName, params);
				}
			}).catch((error) => {
				if (error !== "cancel") {
					console.error("UnityUtil.onLoaded() failed: ", error);
					UnityUtil.userAlert(error, true, true);
				}
			});
		} else if (requireStatus === UnityUtil.LoadingState.MODEL_LOADING) {
			// Requires model to be loading
			UnityUtil.onLoading().then(() => {
				if (UnityUtil.unityInstance) {
					UnityUtil.unityInstance.SendMessage(UnityUtil.UNITY_GAME_OBJECT, methodName, params);
				}
			}).catch((error) => {
				if (error !== "cancel") {
					UnityUtil.userAlert(error, true, true);
					console.error("UnityUtil.onLoading() failed: ", error);
				}
			});
		} else {
			UnityUtil.onReady().then(() => {
				if (UnityUtil.unityInstance) {
					UnityUtil.unityInstance.SendMessage(UnityUtil.UNITY_GAME_OBJECT, methodName, params);
				}
			}).catch((error) => {
				if (error !== "cancel") {
					UnityUtil.userAlert(error, true, true);
					console.error("UnityUtil.onReady() failed: ", error);
				}
			});
		}

	}

	/*
	 * =============== FROM UNITY ====================
	 */

	public static clipBroadcast(clipInfo) {
		if (UnityUtil.viewer && UnityUtil.viewer.clipBroadcast) {
			UnityUtil.viewer.clipBroadcast(JSON.parse(clipInfo));
		}
	}

	public static currentPointInfo(pointInfo) {
		const point = JSON.parse(pointInfo);
		if (UnityUtil.viewer && UnityUtil.viewer.objectSelected) {
			UnityUtil.viewer.objectSelected(point);
		}
	}

	public static comparatorLoaded() {
		UnityUtil.loadComparatorResolve.resolve();
		UnityUtil.loadComparatorPromise = null;
		UnityUtil.loadComparatorResolve = null;
	}

	public static loaded(bboxStr) {
		const res = {
			bbox: JSON.parse(bboxStr)
		};
		UnityUtil.loadedResolve.resolve(res);
		UnityUtil.loadedFlag = true;
	}

	public static loading(bboxStr) {
		UnityUtil.loadingResolve.resolve();
	}

	public static navMethodChanged(newNavMode) {
		if (UnityUtil.viewer && UnityUtil.viewer.navMethodChanged) {
			UnityUtil.viewer.navMethodChanged(newNavMode);
		}
	}

	public static objectsSelectedAlert(nodeInfo) {
		UnityUtil.viewer.objectsSelected(JSON.parse(nodeInfo).nodes);
	}

	public static objectStatusBroadcast(nodeInfo) {
		if (UnityUtil.objectStatusPromise) {
			UnityUtil.objectStatusPromise.resolve(JSON.parse(nodeInfo));
		}
		UnityUtil.objectStatusPromise = null;
	}

	public static ready() {
		// Overwrite the Send Message function to make it run quicker
		// This shouldn't need to be done in the future when the
		// readyoptimisation in added into unity.
		UnityUtil.readyResolve.resolve();
	}

	public static pickPointAlert(pointInfo) {
		const point = JSON.parse(pointInfo);
		if (UnityUtil.viewer && UnityUtil.viewer.pickPointEvent) {
			UnityUtil.viewer.pickPointEvent(point);
		}
	}

	public static screenshotReady(screenshot) {
		const ssJSON = JSON.parse(screenshot);

		UnityUtil.screenshotPromises.forEach((promise) => {
			promise.resolve(ssJSON.ssBytes);
		});

		UnityUtil.screenshotPromises = [];
	}

	public static viewpointReturned(vpInfo) {
		if (UnityUtil.vpPromise != null) {
			let viewpoint = {} ;
			try {
				viewpoint = JSON.parse(vpInfo);
			} catch {
				console.error("Failed to parse viewpoint", vpInfo);
			}
			UnityUtil.vpPromise.resolve(viewpoint);
			UnityUtil.vpPromise = null;
		}
	}

	/*
	 * =============== TO UNITY ====================
	 */

	/**
	 * Centres the viewpoint to the object
	 * @param {Object[]}  - array of json objects each recording {model: <account.modelID>, meshID: [array of mesh IDs]}
	 */
	public static centreToPoint(meshIDs) {
		const params = {
			groups: meshIDs
		};
		UnityUtil.toUnity("CentreToObject", UnityUtil.LoadingState.MODEL_LOADING, JSON.stringify(params));
	}

	/**
	 *  Change the colour of an existing pin
	 *  @param {string} id - ID of the pin
	 *  @param {number[]} colour - colour RGB value of the colour to change to.
	 */
	public static changePinColour(id, colour) {
		const params =  {
			color : colour,
			pinName : id
		};

		UnityUtil.toUnity("ChangePinColor", UnityUtil.LoadingState.MODEL_LOADING, JSON.stringify(params));
	}

	/**
	 * Clear all highlighting.
	 */
	public static clearHighlights() {
		UnityUtil.toUnity("ClearHighlighting", UnityUtil.LoadingState.MODEL_LOADED, undefined);
	}

	/**
	* Visualise the difference view
	* i.e. models will be rendered in greyscale, detailing the difference/clash
	*/
	public static diffToolDiffView() {
		UnityUtil.toUnity("DiffToolShowDiff", undefined, undefined);
	}

	/**
	* Disable diff tool
	* This also unloads the comparator models
	*/
	public static diffToolDisableAndClear() {
		UnityUtil.toUnity("DiffToolDisable", UnityUtil.LoadingState.MODEL_LOADED, undefined);
	}

	/**
	* Enable diff tool
	* This starts the diff tool in diff mode
	*/
	public static diffToolEnableWithDiffMode() {
		UnityUtil.toUnity("DiffToolStartDiffMode", UnityUtil.LoadingState.MODEL_LOADED, undefined);
	}

	/**
	* Enable diff tool
	* This starts the diff tool in clash mode
	*/
	public static diffToolEnableWithClashMode() {
		UnityUtil.toUnity("DiffToolStartClashMode", UnityUtil.LoadingState.MODEL_LOADED, undefined);
	}

	/**
	 * Load comparator model for diff tool
	 * This returns a promise which will be resolved when the comparator model is loaded
	 * @param {string} account - name of teamspace
	 * @param {string} model - model ID
	 * @param {revision=} revision - revision ID/tag to load
	 */
	public static diffToolLoadComparator(account, model, revision) {

		const params: any = {
			database : account,
			model
		};

		if (revision !== "head") {
			params.revID = revision;
		}
		UnityUtil.toUnity("DiffToolLoadComparator", UnityUtil.LoadingState.MODEL_LOADED, JSON.stringify(params));

		if (!UnityUtil.loadComparatorPromise) {
			UnityUtil.loadComparatorPromise = new Promise((resolve, reject) => {
				UnityUtil.loadComparatorResolve = {resolve, reject};
			});
		}
		return UnityUtil.loadComparatorPromise;
	}

	/**
	 * Set an existing submodel/model as a comparator model
	 * This will return as a base model when you have cleared the comparator (i.e. disabled diff)
	 * @param {string} account - name of teamspace
	 * @param {string} model - model ID
	 */
	public static diffToolSetAsComparator(account: string, model: string) {
		const params: any = {
			database : account,
			model
		};
		UnityUtil.toUnity("DiffToolAssignAsComparator", UnityUtil.LoadingState.MODEL_LOADED, JSON.stringify(params));

	}

	/**
	 * Set tolerance threshold
	 * @param {string} theshold - tolerance level for diffing/clashing
	 */
	public static diffToolSetThreshold(theshold) {
		UnityUtil.toUnity("DiffToolSetThreshold", UnityUtil.LoadingState.MODEL_LOADED, theshold);

	}

	/**
	* Only show the comparator model
	* i.e. Only show the model you are trying to compare with, not the base model
	*/
	public static diffToolShowComparatorModel() {
		UnityUtil.toUnity("DiffToolShowComparatorModel", undefined, undefined);
	}

	/**
	* Only show the base model
	* i.e. It will show only the original model, not the comparator nor the diff view
	*/
	public static diffToolShowBaseModel() {
		UnityUtil.toUnity("DiffToolShowBaseModel", undefined, undefined);
	}

	/**
	* Compare transparent objects as if they are opaque objects
	*/
	public static diffToolRenderTransAsOpaque() {
		UnityUtil.toUnity("DiffToolRenderTransAsOpaque", undefined, undefined);
	}

	/**
	* Ignore semi-transparent objects in diff
	*/
	public static diffToolRenderTransAsInvisible() {
		UnityUtil.toUnity("DiffToolRenderTransAsInvisible", undefined, undefined);
	}

	/**
	* Compare transparent objects as of normal
	*/
	public static diffToolRenderTransAsDefault() {
		UnityUtil.toUnity("DiffToolRenderTransAsDefault", undefined, undefined);
	}

	/**
	*  Turn off any clipping planes imposed into the viewer
	*/
	public static disableClippingPlanes() {
		UnityUtil.toUnity("DisableClip", undefined, undefined);
	}

	/**
	 * Disable the Measuring tool.
	 */
	public static disableMeasuringTool() {
		UnityUtil.toUnity("StopMeasuringTool", UnityUtil.LoadingState.MODEL_LOADING, undefined);
	}

	/**
	 * Add a pin
	 * @param {string} id - Identifier for the pin
	 * @param {number[]} position - point in space where the pin should generate
	 * @param {number[]} normal - normal vector for the pin (note: this is no longer used)
	 * @param {number[]} colour - RGB value for the colour of the pin
	 */
	public static dropPin(id, position, normal, colour) {
		const params = {
			id,
			position,
			normal,
			color : colour
		};
		UnityUtil.toUnity("DropPin", UnityUtil.LoadingState.MODEL_LOADING, JSON.stringify(params));
	}

	/**
	 * Enable measuring tool. This will allow you to start measuring by clicking on the model
	 */
	public static enableMeasuringTool() {
		UnityUtil.toUnity("StartMeasuringTool", UnityUtil.LoadingState.MODEL_LOADING, undefined);
	}

	/**
	 * Get Object Status within the viewer. This will return you the list of
	 * objects that are currently set invisible, and a list of object that are
	 * currently highlighted.
	 *
	 * The object status will be returned via the promise provided.
	 * @param {string} account - name of teamspace
	 * @param {string} model - name of the model
	 * @param {object} promise - promise that the function will resolve with the object status info.
	 */
	public static getObjectsStatus(account, model, promise) {
		let nameSpace = "";
		if (account && model) {
			nameSpace = account + "." + model;
		}
		if (UnityUtil.objectStatusPromise && UnityUtil.objectStatusPromise.then) {
			UnityUtil.objectStatusPromise.then(() => {
				UnityUtil._getObjectsStatus(nameSpace, promise);
			});
		} else {
			UnityUtil._getObjectsStatus(nameSpace, promise);
		}
	}

	public static _getObjectsStatus(nameSpace, promise) {
		UnityUtil.objectStatusPromise = promise;
		UnityUtil.toUnity("GetObjectsStatus", UnityUtil.LoadingState.MODEL_LOADED, nameSpace);
	}

	public static getPointInfo() {
		UnityUtil.toUnity("GetPointInfo", false, 0);
	}

	/**
	 * Decrease the speed of Helicopter navigation (by x0.75)
	 */
	public static helicopterSpeedDown() {
		UnityUtil.toUnity("HelicopterSpeedDown", UnityUtil.LoadingState.VIEWER_READY, undefined);
	}

	/**
	 * Increase the speed of Helicopter navigation (by x1.25)
	 */
	public static helicopterSpeedUp() {
		UnityUtil.toUnity("HelicopterSpeedUp", UnityUtil.LoadingState.VIEWER_READY, undefined);
	}

	/**
	 * Reset the speed of Helicopter navigation
	 */
	public static helicopterSpeedReset() {
		UnityUtil.toUnity("HelicopterSpeedReset", UnityUtil.LoadingState.VIEWER_READY, undefined);
	}

	public static hideHiddenByDefaultObjects() {
		UnityUtil.toUnity("HideHiddenByDefaultObjects", UnityUtil.LoadingState.MODEL_LOADED, undefined);
	}

	/**
	 *  Highlight objects
	 *  @param {string} account - name of teamspace
	 *  @param {string} model - name of model
	 *  @param {string[]} idArr - array of unique IDs associated with the objects to highlight
	 *  @param {number[]} color - RGB value of the highlighting colour
	 *  @param {bool} toggleMode - If set to true, existing highlighted objects will stay highlighted.
	 *  				Also any objects that are already highlighted will be unhighlighted
	 *  @param {bool} forceReHighlight - If set to true, existing highlighted objects will be forced
	 * 					to re-highlight itself. This is typically used for re-colouring a highlight ]
	 * 					or when you want a specific set of objects to stay highlighted when toggle mode is on
	 */
	public static highlightObjects(account, model, idArr, color, toggleMode, forceReHighlight) {
		const params: any = {
			database : account,
			model,
			ids : idArr,
			toggle : toggleMode,
			forceReHighlight
		};

		if (color) {
			params.color = color;
		} else  {
			params.color = UnityUtil.defaultHighlightColor;
		}

		UnityUtil.toUnity("HighlightObjects", UnityUtil.LoadingState.MODEL_LOADED, JSON.stringify(params));
	}

	/**
	 *  Unhighlight objects
	 *  @param {string} account - name of teamspace
	 *  @param {string} model - name of model
	 *  @param {string[]} idArr - array of unique IDs associated with the objects to highlight
	 */
	public static unhighlightObjects(account, model, idArr) {
		const params: any = {
			database : account,
			model,
			ids : idArr
		};

		UnityUtil.toUnity("UnhighlightObjects", UnityUtil.LoadingState.MODEL_LOADED, JSON.stringify(params));
	}

	/**
	 * Loading another model. NOTE: this will also clear the canvas of existing models
	 * Use branch = master and revision = head to get the latest revision.
	 *  @param {string} account - name of teamspace
	 *  @param {string} model - name of model
	 *  @param {string=} branch - ID of the branch (optional)
	 *  @param {string} revision - ID of revision
	 */
	public static loadModel(account, model, branch, revision) {
		UnityUtil.cancelLoadModel();
		UnityUtil.reset();

		UnityUtil.loadedPromise = null;
		UnityUtil.loadedResolve = null;
		UnityUtil.loadingPromise = null;
		UnityUtil.loadingResolve = null;
		UnityUtil.loadedFlag  = false;

		const params: any = {
			database : account,
			model
		};

		if (revision !== "head") {
			params.revID = revision;
		}

		UnityUtil.onLoaded();
		UnityUtil.toUnity("LoadModel", UnityUtil.LoadingState.VIEWER_READY, JSON.stringify(params));

		return UnityUtil.onLoading();

	}

	/**
	 * Reset map sources.
	 */
	public static resetMapSources() {
		UnityUtil.toUnity("ResetMapSources", UnityUtil.LoadingState.VIEWER_READY, undefined);
	}

	/**
	 * Add map source.
	 * @param {string} mapSource - This can be "OSM", "HERE", "HERE_AERIAL", "HERE_TRAFFIC", "HERE_TRAFFIC_FLOW"
	 */
	public static addMapSource(mapSource) {
		UnityUtil.toUnity("AddMapSource", UnityUtil.LoadingState.VIEWER_READY, mapSource);
	}

	/**
	 * Remove map source.
	 * @param {string} mapSource - This can be "OSM", "HERE", "HERE_AERIAL", "HERE_TRAFFIC", "HERE_TRAFFIC_FLOW"
	 */
	public static removeMapSource(mapSource) {
		UnityUtil.toUnity("RemoveMapSource", UnityUtil.LoadingState.VIEWER_READY, mapSource);
	}

	/**
	 * Initialise map creator within unity
	 * @param {Object[]} surveyingInfo - array of survey points and it's respective latitude and longitude value
	 */
	public static mapInitialise(surveyingInfo) {
		UnityUtil.toUnity("MapsInitiate", UnityUtil.LoadingState.MODEL_LOADING, JSON.stringify(surveyingInfo));
	}

	/**
	 * Start map generation
	 */
	public static mapStart() {
		UnityUtil.toUnity("ShowMap", UnityUtil.LoadingState.MODEL_LOADING, undefined);
	}

	/**
	 * Stop map generation
	 */
	public static mapStop() {
		UnityUtil.toUnity("HideMap", UnityUtil.LoadingState.MODEL_LOADING, undefined);
	}

	/**
	 * Override the diffuse colour of the given meshes
	 * @param {string} account - teamspace the meshes resides in
	 * @param {string} model - model ID the meshes resides in
	 * @param {string[]} meshIDs - unique IDs of the meshes to operate on
	 * @param {number[]} color - RGB value of the override color (note: alpha will be ignored)
	 */
	public static overrideMeshColor(account, model, meshIDs, color) {
		const param: any = {};
		if (account && model) {
			param.nameSpace = account + "."  + model;
		}
		param.ids = meshIDs;
		param.color = color;
		UnityUtil.toUnity("OverrideMeshColor", UnityUtil.LoadingState.MODEL_LOADED, JSON.stringify(param));
	}

	/**
	 * Restore the meshes to its original color values
	 * @param {string} account - teamspace the meshes resides in
	 * @param {string} model - model ID the meshes resides in
	 * @param {string[]} meshIDs - unique IDs of the meshes to operate on
	 */
	public static resetMeshColor(account, model, meshIDs) {
		const param: any = {};
		if (account && model) {
			param.nameSpace = account + "."  + model;
		}
		param.ids = meshIDs;
		UnityUtil.toUnity("ResetMeshColor", UnityUtil.LoadingState.MODEL_LOADED, JSON.stringify(param));
	}

	/**
	 * Remove a pin from the viewer
	 * @param {string} id - pin identifier
	 */
	public static removePin(id) {
		UnityUtil.toUnity("RemovePin", UnityUtil.LoadingState.MODEL_LOADING, id);
	}

	/**
	 * Clear the canvas and reset all settings
	 */
	public static reset() {
		UnityUtil.disableMeasuringTool();
		UnityUtil.disableClippingPlanes();
		UnityUtil.toUnity("ClearCanvas", UnityUtil.LoadingState.VIEWER_READY, undefined);
	}

	/**
	 * Reset the viewpoint to ISO view.
	 */
	public static resetCamera() {
		UnityUtil.toUnity("ResetCamera", UnityUtil.LoadingState.VIEWER_READY, undefined);
	}

	/**
	 * Request a screenshot. The screenshot will be returned as a JSON
	 * object with a single field, ssByte, containing the screenshot in
	 * base64.
	 * @param {object} promise - promise that will be resolved, returning with the screenshot
	 */
	public static requestScreenShot(promise) {
		UnityUtil.screenshotPromises.push(promise);
		UnityUtil.toUnity("RequestScreenShot", UnityUtil.LoadingState.VIEWER_READY, undefined);
	}

	/**
	 * Request the information of the current viewpoint
	 *  @param {string} account - name of teamspace
	 *  @param {string} model - name of model
	 *  @param {Object} promise - promises where the viewpoint will be returned when the promise resolves
	 */
	public static requestViewpoint(account, model, promise) {
		if (UnityUtil.vpPromise != null) {
			UnityUtil.vpPromise.then(UnityUtil._requestViewpoint(account, model, promise));
		} else {
			UnityUtil._requestViewpoint(account, model, promise);
		}

	}

	public static _requestViewpoint(account, model, promise) {
		const param: any = {};
		if (account && model) {
			param.namespace = account + "."  + model;
		}
		UnityUtil.vpPromise = promise;
		UnityUtil.toUnity("RequestViewpoint", UnityUtil.LoadingState.MODEL_LOADING, JSON.stringify(param));
	}

	/**
	 * Set API host urls. This is needs to be called before loading model.
	 * @param {string[]} hostname - list of API names to use. (e.g https://api1.www.3drepo.io/api/)
	 */
	public static setAPIHost(hostname) {
		UnityUtil.toUnity("SetAPIHost", UnityUtil.LoadingState.VIEWER_READY, JSON.stringify(hostname));
	}

	/**r
	 * Set navigation mode.
	 * @param {string} navMode - This can be either "HELICOPTER" or "TURNTABLE"
	 */
	public static setNavigation(navMode) {
		UnityUtil.toUnity("SetNavMode", UnityUtil.LoadingState.VIEWER_READY, navMode);
	}

	/**
	 * Set the units
	 * By default, units are set to mm.
	 * @param {string} units - i.e. "m", "mm", "ft" etc.
	 */
	public static setUnits(units) {
		UnityUtil.toUnity("SetUnits", UnityUtil.LoadingState.MODEL_LOADING, units);
	}

	/**
	 * Move viewpoint to the specified paramters
	 * teamspace and model is only needed if the viewpoint is relative to a model
	 * @param {number[]} pos - 3D point in space where the camera should be
	 * @param {number[]} up - Up vector
	 * @param {number[]} forward - forward vector
	 * @param {number[]} lookAt - point in space the camera is looking at. (pivot point)
	 * @param {string=} account - name of teamspace
	 * @param {string=} model - name of model
	 */
	public static setViewpoint(pos, up, forward, lookAt, account, model) {
		const param: any = {};
		if (account && model) {
			param.nameSpace = account + "." + model;
		}

		param.position = pos;
		param.up = up;
		param.forward = forward;
		param.lookAt = lookAt;
		UnityUtil.toUnity("SetViewpoint", UnityUtil.LoadingState.MODEL_LOADING, JSON.stringify(param));

	}

	/**
	 * Make all hidden by default objects visible
	 */
	public static showHiddenByDefaultObjects() {
		UnityUtil.toUnity("ShowHiddenByDefaultObjects", UnityUtil.LoadingState.MODEL_LOADED, undefined);
	}

	/**
	 * Start rectangular select
	 */
	public static startAreaSelection() {
		UnityUtil.toUnity("StartRectangularSelect", UnityUtil.LoadingState.MODEL_LOADING, undefined);
	}

	/**
	 * Stop rectangular select
	 */
	public static stopAreaSelection() {
		UnityUtil.toUnity("StopRectangularSelect", UnityUtil.LoadingState.MODEL_LOADING, undefined);
	}

	/**
	 * Toggle on/off rendering statistics.
	 * When it is toggled on, list of stats will be displayed in the top left corner of the viewer.
	 */
	public static toggleStats() {
		UnityUtil.toUnity("ShowStats", UnityUtil.LoadingState.VIEWER_READY, undefined);
	}

	/**
	 * Toggle visibility of the given list of objects
	 *  @param {string} account - name of teamspace
	 *  @param {string} model - name of model
	 *  @param {string[]} ids - list of unique ids to toggle visibility
	 *  @param {bool} visibility - true = toggle visible, false = toggle invisible
	 */
	public static toggleVisibility(account, model, ids, visibility) {
		const param: any = {};
		if (account && model) {
			param.nameSpace = account + "." + model;
		}

		param.ids = ids;
		param.visible = visibility;
		UnityUtil.toUnity("ToggleVisibility", UnityUtil.LoadingState.MODEL_LOADED, JSON.stringify(param));

	}

	/**
	 * Update the clipping plane to the given direction
	 * teamspace and model is only needed if the viewpoint is relative to a model
	 * @example
	 * //Clipping plane is defined by the plane normal, distance from origin and it's direction
	 * //direction = -1 means it will clip anything above the plane, 1 otherwise.
	 * UnityUtil.updateClippingPlanes({normal : [0,-1,0], distance: 10, clipDirection: -1}, false)
	 * @param {Object} clipPlane - object containing the clipping plane
	 * @param {bool} requireBroadcast - if set to true, UnityUtil.clipBroadcast will be called after it is set.
	 * @param {string=} account - name of teamspace
	 * @param {string=} model - name of model
	 */
	public static updateClippingPlanes(clipPlane, requireBroadcast, account, model) {
		const param: any = {};
		param.clip = clipPlane;
		if (account && model) {
			param.nameSpace = account + "." + model;
		}
		param.requiresBroadcast = requireBroadcast;
		UnityUtil.toUnity("UpdateClip", UnityUtil.LoadingState.MODEL_LOADING, JSON.stringify(param));
	}

	/**
	 * Zoom to highlighted meshes
	 */
	public static zoomToHighlightedMeshes() {
		UnityUtil.toUnity("ZoomToHighlightedMeshes", UnityUtil.LoadingState.MODEL_LOADING, undefined);
	}

}
