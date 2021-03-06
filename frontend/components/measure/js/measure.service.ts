/**
 *  Copyright (C) 2017 3D Repo Ltd
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

export class MeasureService {

	public static $inject: string[] = [
		"ViewerService"
	];

	private state: any;

	constructor(
		private ViewerService: any
	) {
		this.state = {
			active: false,
			disabled: false
		};
	}

	public activateMeasure() {
		this.state.active = true;
		this.ViewerService.activateMeasure();
	}

	public deactivateMeasure() {
		this.state.active = false;
		this.ViewerService.disableMeasure();
	}

	public setDisabled(disabled) {
		this.state.disabled = disabled;

		// If we're disabling the button we also
		// want to deactivate the tool itself
		if (disabled) {
			this.state.active = false;
		}
	}

	public toggleMeasure() {
		if (!this.state.active) {
			this.activateMeasure();
		} else {
			this.deactivateMeasure();
		}
	}

}

export const MeasureServiceModule = angular
	.module("3drepo")
	.service("MeasureService", MeasureService);
