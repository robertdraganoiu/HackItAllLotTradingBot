// CONSTANTS
const getCurrency = document.getElementById('get-currency');
const base = document.getElementById("cur");
const accepted_currencies = ["RON", "EUR", "USD", "GBP", "CHF"];
const fluctuations = [1, 0.209086, 0.235743, 0.184622, 0.228602,
                      4.78342, 1, 1.12761, 0.883042, 1.09312,
                      4.24465, 0.887454, 1, 0.783428, 0.970006,
                      5.42028, 1.13319, 1.27740, 1, 1.23885,
                      4.37949, 0.915352, 1.03210, 0.808409, 1];
const symbols = ["EUR", "RON", "USD", "GBP", "CHF"];

function currencyToId(cur) {
    switch(cur) {
        case "RON":
            return 0;
        case "EUR":
            return 1;
        case "USD":
            return 2;
        case "GBP":
            return 3;
        case "CHF":
            return 4;
        default:
            return -1;
    }
};

function idToCurrency(id) {
    switch(id) {
        case 0:
            return "RON";
        case 1:
            return "EUR";
        case 2:
            return "USD";
        case 3:
            return "GBP";
        case 4:
            return "CHF";
        default:
            return -1;
    }
};


// currency rates updating
const currencies = 5;
var currencyArbitrage = new Array(currencies);
var currenciesAsList = new Array(currencies * currencies);
var day = 8640000; // 24h;
var updateIntervalMatrix = day;

for (var i = 0; i < currencies; ++i) {
    currencyArbitrage[i] = new Array(currencies);
}

// populate currency matrix and add to database
setInterval(function(){
    var xhr = [];
    for (var i = 0; i < currencies; ++i) {
        var base = accepted_currencies[i];
        var put = 0;
        (function(i){
            xhr[i] = new XMLHttpRequest();
            var url = "https://api.exchangeratesapi.io/latest?base=" + base + "&symbols=";
            for(var j = 0; j < currencies; ++j) {
                if (i != j) {
                    url += accepted_currencies[j];
                    if (put < currencies - 2) {
                        url += ",";
                    }
                    put++;
                }
            }
            xhr[i].open("GET", url);
            xhr[i].send();
            xhr[i].onreadystatechange = function(){
                if (xhr[i].readyState === 4 && xhr[i].status === 200){
                    // console.log('Response from request ' + i + ' [ ' + xhr[i].responseText + ']');
                    var json = JSON.parse(xhr[i].responseText);
                    currencyArbitrage[i][i] = 1;
                    currenciesAsList[i * currencies + i] = 1;
                    for (var rate in json.rates) {
                        currencyArbitrage[i][currencyToId(rate)] = json.rates[rate];
                        currenciesAsList[i * currencies + currencyToId(rate)] = json.rates[rate];
                    }
                }
            };
        })(i);

    }

    // update old currencies, add new currencies to database
    db.collection('api-info').doc('currencies').get().then(function(doc) {
        var curr = doc.data().currencies;
        var docData = {
            oldCurrencies: curr,
            currencies: currenciesAsList,
        };
        db.collection('api-info').doc('currencies').set(docData).then(function() {
            console.log("Data successfully added!");
        });
    })

    // one time needed
    // db.collection('api-info').doc('fluctuations').get().then(function(doc) {
    //     var docData = {
    //         fluctuations: fluctuations,
    //     };
    //     db.collection('api-info').doc('fluctuations').set(docData).then(function() {
    //         console.log("Data successfully added!");
    //     });
    // })

}, updateIntervalMatrix);

// exchange bot
const updateIntervalExchangeBot = 20000;
usersRef = db.collection('users');

// currently deactivated for demo purposes
function hasExchangePossibility(data) {
    return true;
    if (Date.now() - data.lastCheck < data.checkInterval * 1000) {
        return false;
    }
    return true;
}

// exchange algorithm
function checkPossibleExchanges(id, data) {
    db.collection('api-info').doc('currencies').get().then(function(doc) {
        var old = doc.data().oldCurrencies;
        var curr = doc.data().currencies;
        var accounts = data.accountsRefs;
        let waitApproval = data.waitForApproval;
        let waitMessages = "";
        let nonWaitMessages = "";

        for(let i = 0; i < accounts.length; ++i) {
            let currentBestScore = 0;
            let bestExchangeRate = 1;
            let bestExchangeCurrency = accounts[i].type;
            let currentCurrency = accounts[i].type;
            let score;
            for(let j = 0; j < currencies; ++j) {
                if (currencyToId(currentCurrency) == j) {
                    continue;
                }

                db.collection('api-info').doc('fluctuations').get().then(function(doc1) {
                    // more points if it is rising
                    score = curr[currencyToId(currentCurrency) * currencies + j] - old[currencyToId(currentCurrency) * currencies + j];
                    score += curr[currencyToId(currentCurrency) * currencies + j] - doc1.data().fluctuations[currencyToId(currentCurrency) * currencies + j];

                    if (score > currentBestScore) {
                        currentBestScore = score;
                        bestExchangeRate = curr[currencyToId(currentCurrency) * currencies + j];
                        bestExchangeCurrency = idToCurrency(j);
                    }
                    if (j == currencies - 1) {
                        if (currentCurrency == bestExchangeCurrency) {
                            if (waitApproval) {
                                waitMessages += "-you should keep your " + currentCurrency + " as it is.\r\n";
                            }
                        } else {
                            if (waitApproval) {
                                waitMessages += "-you should change " + currentCurrency +  " to " + bestExchangeCurrency + " for some profit!\r\n";
                            } else {
                                accounts[i].balance = accounts[i].balance * bestExchangeRate;
                                accounts[i].type = bestExchangeCurrency;
                                nonWaitMessages += "-I changed from account " + i + " " + currentCurrency +  " to " + bestExchangeCurrency + " for you to make some profit!\r\n"
                            }
                        }
                    }
                    if (i == accounts.length - 1) {
                        if (waitApproval) {
                            // sendEmail(data.email, "Hello " + data.name + ",\r\nHere is your daily update about your currencies:\r\n" + waitMessages + "\r\nHave a nice day,\r\nLotTrading Bot.\r\n");
                            console.log(waitMessages);
                        } else {
                            if (nonWaitMessages == "") {
                                // sendEmail(data.email, "Hello " + data.name + ",\r\nI wanted to inform you that everything is working good and no changes were made today!\r\nHave a nice day,\r\nLotTrading Bot.\r\n");
                            } else {
                                // sendEmail(data.email, "Hello " + data.name + ",\r\nHere is your daily update about my changes:\r\n" + nonWaitMessages + "\nHave a nice day,\nLotTrading Bot.\n");
                                console.log(nonWaitMessages);
                                db.collection("users").doc(id).update({
                                    accountsRefs: accounts
                                })
                            }
                        }
                    }
                })
            } 
        }
    })
}

// LotBot periodic check
setInterval(function() {
    db.collection("users").where("botEnabled", "==", true)
    .get()
    .then(function(querySnapshot) {
        querySnapshot.forEach(function(doc) {
            if (hasExchangePossibility(doc.data())) {

                // verify if can check
                if(!hasExchangePossibility(doc.data())) {
                    return;
                }

                // make check
                checkPossibleExchanges(doc.id, doc.data());

                // update check info
                db.collection('users').doc(doc.id).update({
                    lastCheck: Date.now()
                })
            }
        });
    })
    .catch(function(error) {
        console.log("Error getting documents: ", error);
    });

}, updateIntervalExchangeBot);


// mail sending
function sendEmail(email, message) {
	Email.send({
	    Host: "smtp.gmail.com",
	    Username : "lotulsuperior@gmail.com",
	    Password : "lotul2020",
	    To : email,
	    From : "lotulsuperior@gmail.com",
	    Subject : "LotTrading Update",
	    Body : message,
	}).then(
		message => alert("Mail sent successfully")
	);
}

// all currenciy rates for one currency
getCurrency.onclick = () => {
    var rates = 0;
    var len = symbols.length;

    var Http = new XMLHttpRequest();
    var url = "https://api.exchangeratesapi.io/latest?base=" + base.value + "&symbols=";

    for(var i = 0; i < len; ++i) {
        if (symbols[i] != base.value) {
            url += symbols[i];
            if (rates < currencies - 2) {
                url += ",";    
            }
            rates++;
        }
    }

    // for feature graph
    // var url2 = "https://api.exchangeratesapi.io/history?start_at=2018-01-01&end_at=2018-09-01&base=USD&symbols=RON";
    Http.open("GET", url);
    Http.send();

    Http.onreadystatechange=function(){
        if(this.readyState==4 && this.status==200) {
            var json = JSON.parse(Http.responseText);
            var result = "";
            

            for (var r in json.rates) {
                result += "1 " + base.value + " = " + json.rates[r] + " " + r;
                result += "\n";
            }
            
            window.alert(result);
        }
    }
}


// arbitrage algorithm
function neg_log(matrix) {
    for (r in matrix) {
        for (c in r) {
            c = -Math.log(c);
        }
    }

    return matrix;
}

function fillArray(value, len) {
    var arr = [];
    for (var i = 0; i < len; i++) {
      arr.push(value);
    }
    return arr;
}


function arbitrage (mat) {
    var new_mat = neg_log(mat);

    var n = new_mat.length;
    var source = 0;

    var min_dist = fillArray(10000, n);
    min_dist[source] = source;

    var pre = fillArray(-1, n);

    for (i = 0; i < n - 1; ++i) {
        for (s_curr = 0; s_curr < n; ++s_curr) {
            for (d_curr = 0; d_curr < n; ++d_curr) {
                if (min_dist[d_curr] > min_dist[s_curr] + new_mat[s_curr][d_curr]) {
                    min_dist[d_curr] = min_dist[s_curr] + new_mat[s_curr][d_curr];
                    pre[d_curr] = s_curr;
                }
            }
        }
    }

    for (s_curr = 0; s_curr < n; ++s_curr) {
        for (d_curr = 0; d_curr < n; ++d_curr) {
            if (min_dist[d_curr] > min_dist[s_curr] + new_mat[s_curr][d_curr]) {
                console.log("Arbitrage opportunity");
                // TO DO
                var multiply = mat[s_curr][d_curr];
                
                while (pre[s_curr] != d_curr) {
                    multiply *= mat[pre[s_curr]][s_curr];
                    s_curr = pre[s_curr];
                    
                }
                return multiply; // Returts the multiplier factor

            }
        }
    }
    return 1;
}