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


var nodemailer = require('nodemailer');
var config = require('../config');
var C = require('../constants');
var responseCodes = require('../response_codes');
var getBaseURL = config.getBaseURL;
var transporter;

function sendEmail(template, to, data, attachments){
	'use strict';


	if(!config.mail || !config.mail.smtpConfig){
		return Promise.reject({ message: 'config.mail.smtpConfig is not set'});
	}

	if(!config.mail || !config.mail.smtpConfig){
		return Promise.reject({ message: 'config.mail.sender is not set'});
	}

	let mailOptions = {
		from: config.mail.sender,
		to: to,
		subject: typeof template.subject === 'function' ? template.subject(data) : template.subject,
		html: template.html(data)
	};

	if(attachments){
		mailOptions.attachments = attachments;
	}

	transporter = transporter || nodemailer.createTransport(config.mail.smtpConfig);

	return new Promise((resolve, reject) => {
		transporter.sendMail(mailOptions, function(err, info){
			if(err){
				reject(err);
			} else {
				resolve(info);
			}
		});
	});
}

function rejectNoUrl(name){
	return Promise.reject({ message: `config.mails.urls[${name}] is not defined`})
}


function getURL(urlName, params){
	'use strict';

	if(!C.MAIL_URLS || !C.MAIL_URLS[urlName]){
		return null;
	}

	return getBaseURL() + C.MAIL_URLS[urlName](params);
}

function sendNoConsumerAlert(){
	if(config.contact){
		const template = require('./templates/noConsumers');
		return sendEmail(template, config.contact.email, {domain: config.host});
	}
	else{
		return Promise.reject({ message: 'config.contact is not set'});
	}
}

function sendVerifyUserEmail(to, data){
	'use strict';

	data.url = getURL('verify', {token: data.token, username: data.username, pay: data.pay});

	if(!data.url){
		return rejectNoUrl('verify');
	}

	let template = require('./templates/verifyUser');
	return sendEmail(template, to, data);
}


function sendResetPasswordEmail(to, data){
	'use strict';

	data.url = getURL('forgotPassword', {token: data.token, username: data.username});

	if(!data.url){
		return rejectNoUrl('forgotPassword');
	}

	let template = require('./templates/forgotPassword');
	return sendEmail(template, to, data);
}

function sendPaymentReceivedEmail(to, data, attachments){
	'use strict';

	let template = require('./templates/paymentReceived');


	return sendEmail(template, to, data, attachments);
}

function sendPaymentReceivedEmailToSales(data, attachments){
	'use strict';

	let template = require('./templates/paymentReceived');
	
	if(data.type === 'refund'){
		template = require('./templates/paymentRefunded');
	}

	let salesTemplate = {
		html: template.html,
		subject: function(data){
			return `[${data.type}] [${data.invoiceNo}] ${data.email}`;
		}
	};

	if(config.contact && config.contact.sales){
		//console.log(config.contact.sales);
		return sendEmail(salesTemplate, config.contact.sales, data, attachments);
	} else {
		return Promise.resolve();
	}

	
}

function sendNewUser(data){
	'use strict';

	let template = require('./templates/newUser');

	data.url = getBaseURL();
	
	if(config.contact && config.contact.sales){
		//console.log(config.contact.sales);
		return sendEmail(template, config.contact.sales, data);
	} else {
		return Promise.resolve();
	}
}

function sendContactEmail(data){
	'use strict';

	let template = require('./templates/contact');
	
	if(!config.contact || !config.contact.email){
		return Promise.reject(responseCodes.NO_CONTACT_EMAIL);
	}

	return sendEmail(template, config.contact.email, data);
}



function sendPaymentFailedEmail(to, data){
	'use strict';

	let template = require('./templates/paymentFailed');
	return sendEmail(template, to, data);

}

function sendPaymentRefundedEmail(to, data, attachments){
	'use strict';

	let template = require('./templates/paymentRefunded');
	return sendEmail(template, to, data, attachments);

}

function sendSubscriptionSuspendedEmail(to, data){
	'use strict';

	let template = require('./templates/paymentSuspended');
	data.url = getBaseURL() + `/${data.billingUser}/?page=billing`;

	return sendEmail(template, to, data);

}

function sendPaymentErrorEmail(data){
	'use strict';

	let template = require('./templates/paymentError');
	return sendEmail(template, config.contact.email, data);
}

function sendModelInvitation(to, data){
	'use strict';

	data.url = getURL('model', { account: data.account, model: data.model });

	if(!data.url){
		return rejectNoUrl('model');
	}

	let template = require('./templates/invitedToModel');
	return sendEmail(template, to, data);
}

function sendImportError(data){
	'use strict';

	if(config.contact){
		let template = require('./templates/importError');
		data.domain = config.host;
		return sendEmail(template, config.contact.email, data);
	}
	else
	{
		return Promise.reject({ message: 'config.mail.sender is not set'});
	}
}

module.exports = {
	sendVerifyUserEmail,
	sendResetPasswordEmail,
	sendPaymentReceivedEmail,
	sendContactEmail,
	sendPaymentFailedEmail,
	sendPaymentErrorEmail,
	sendModelInvitation,
	sendSubscriptionSuspendedEmail,
	sendPaymentReceivedEmailToSales,
	sendPaymentRefundedEmail,
	sendImportError,
	sendNewUser,
	sendNoConsumerAlert
}
