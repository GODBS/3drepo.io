/**
 *  Copyright (C) 2014 3D Repo Ltd
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

var paypal = require('paypal-rest-sdk');
var url = require('url');
var config = require('../config');
var vat = require('./vat');

paypal.configure({
	'mode': config.paypal.mode, //sandbox or live
	'client_id': config.paypal.client_id,
	'client_secret': config.paypal.client_secret
});

function getBillingAgreement(billingUser, billingAddress, currency, initAmount, firstCycleAmount, amount, billingCycle, startDate, firstCycleLength){
	'use strict';

	console.log('firstCycleAmount', firstCycleAmount);
	console.log('amount', amount);
	console.log('startDate', startDate);

	let apiServerConfig = config.servers.find(server => server.service === 'api');
	let port = '';
	if(config.using_ssl && apiServerConfig.public_port !== 443 || !config.using_ssl && apiServerConfig.public_port !== 80){
		port = ':' + apiServerConfig.public_port;
	}

	let baseUrl = (config.using_ssl ? 'https://' : 'http://') + config.host + port;

	let taxAmount = vat.getByCountryCode(billingAddress.country_code) * amount;
	taxAmount = Math.round(taxAmount * 100) / 100;
	let afterTaxAmount = amount - taxAmount;

	let taxFirstCycleAmount = vat.getByCountryCode(billingAddress.country_code) * firstCycleAmount;
	taxFirstCycleAmount = Math.round(taxFirstCycleAmount * 100) / 100;
	let afterTaxFirstCycleAmount = firstCycleAmount - taxFirstCycleAmount;

	let billingPlanAttributes = {
		"description": "3D Repo License",
		"merchant_preferences": {
			"auto_bill_amount": "yes",
			"cancel_url": `${baseUrl}/${billingUser}?page=billing`,
			"initial_fail_amount_action": "continue",
			"max_fail_attempts": "0",
			"return_url": `${baseUrl}/${billingUser}?page=billing`
		},
		"name": "3D Repo Licences",
		"payment_definitions": [{
			"amount": {
				"currency": currency,
				"value": afterTaxFirstCycleAmount
			},
			"cycles": "1",
			"frequency": "DAY",
			"frequency_interval": firstCycleLength,
			"name": "First month payment after free trial",
			"type": "TRIAL",
			"charge_models":[{
				"type": "TAX",
				"amount": {
					"value": taxFirstCycleAmount,
					"currency": currency
				}
			}]
		}, {
			"amount": {
				"currency": currency,
				"value": afterTaxAmount
			},
			"cycles": "0",
			"frequency": "MONTH",
			"frequency_interval": billingCycle,
			"name": "Monthly payment",
			"type": "REGULAR",
			"charge_models":[{
				"type": "TAX",
				"amount": {
					"value": taxAmount,
					"currency": currency
				}
			}]
		}],
	    "type": "INFINITE"
	};

	if(initAmount){
		billingPlanAttributes.setup_fee = {
			"value": initAmount,
			"currency": "GBP"
		};
	}

	console.log(billingPlanAttributes);

	return new Promise((resolve, reject) => {

		// create plan
		paypal.billingPlan.create(billingPlanAttributes, function (err, billingPlan) {
			
			if(err){
				reject(err);
			} else {
				resolve(billingPlan);
			}
		});

	}).then(billingPlan => {

		//activate plan
		return new Promise((resolve, reject) => {
			var billingPlanUpdateAttributes = [
				{
					"op": "replace",
					"path": "/",
					"value": {
						"state": "ACTIVE"
					}
				}
			];

			paypal.billingPlan.update(billingPlan.id, billingPlanUpdateAttributes, function (err) {
				if (err) {
					reject(err);
				} else {
					resolve(billingPlan);
				}
			});

		});
	}).then(billingPlan => {

		//create agreement
		return new Promise((resolve, reject) => {

			var billingAgreementAttributes = {
				"name": "3D Repo Licenses",
				"description": `3D Repo License subscription. First month free, then the following month's pro-rata price: £${firstCycleAmount}, then each month: £${amount}`,
				"start_date": startDate.toISOString(),
				"plan": {
					"id": billingPlan.id
				},
				"payer": {
					"payment_method": "paypal"
				},
				"shipping_address": billingAddress
			};

			paypal.billingAgreement.create(billingAgreementAttributes, function (err, billingAgreement) {
				if (err) {
					reject(err);
				} else {

					console.log(billingAgreement);
					let link = billingAgreement.links.find(link => link.rel === 'approval_url');
					let token = url.parse(link.href, true).query.token;

					resolve({ 
						url: link.href, 
						paypalPaymentToken: token
					});
				}
			});

		});


	});

}

function updateBillingAddress(billingAgreementId, billingAddress){
	'use strict';

	let updateOps = [
		{
			"op": "replace",
			"path": "/",
			"value": {
				"shipping_address": billingAddress
			}
		}
	];

	return new Promise((resolve, reject) => {
		paypal.billingAgreement.update(billingAgreementId, updateOps, function (err, billingAgreement) {
			if (err) {
				reject(err);
			} else {
				console.log(JSON.stringify(billingAgreement));
				resolve(billingAgreement);
			}
		});
	});

}

module.exports = {
	getBillingAgreement,
	updateBillingAddress,
	paypal
};
