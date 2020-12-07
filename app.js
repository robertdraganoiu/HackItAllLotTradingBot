
/// Auth stuff
const auth = firebase.auth();
const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const login = document.getElementById("loginBut");
const email = document.getElementById("email");
const password = document.getElementById("password");

const whenSignedIn = document.getElementById('whenSignedIn');
const whenSignedOut = document.getElementById('whenSignedOut');
const userDetails = document.getElementById('userDetails');


const provider = new firebase.auth.GoogleAuthProvider();

signInBtn.onclick = () => auth.signInWithPopup(provider);
login.onclick = () => {
    auth.signInWithEmailAndPassword(email.value, password.value)
    .then((user) => {
        user = email.value;
    })
    .catch((error) => {
        var errorMessage = error.message;

        window.alert("Error: " + errorMessage);
    });
}
signOutBtn.onclick = () => auth.signOut();

auth.onAuthStateChanged(user => {
    if (user) {
        // signed in
        whenSignedIn.hidden = false;
        whenSignedOut.hidden = true;
        var displayText = user.displayName;
        if (displayText == null) {
            displayText = user.email.split("@", 1);
        }
        userDetails.innerHTML = `<h1>Hello ${displayText}!</h1>`;
    } else {
        // not signed in
        whenSignedIn.hidden = true;
        whenSignedOut.hidden = false;
        userDetails.innerHTML = '';
    }
});


// DB stuff

function addAccountOnClick() {
    var currency = document.getElementById("accountMoneyType").value;

    usersRef.get().then(function(doc) {
        var accounts = doc.data().accountsRefs;
        
        if (accounts.length == 3) {
            window.alert("You have reached the maximum number of accounts created");
            return;
        }

        accounts.push({
            type: currency,
            balance: 0.0000
        })
        
        usersRef.update({
            accounts: doc.data().accounts + 1,
            accountsRefs: accounts
        })
    })
}

function addMoneyOnclick() {
    addOrExtractMoney(1);
}

function extractMoneyOnclick() {
    addOrExtractMoney(-1);
}

function addOrExtractMoney(sign) {
    var num = parseFloat(document.getElementById("add_money_acc_num").value) - 1;
    var amount = parseFloat(document.getElementById("add_money_amount").value);

    usersRef.get().then(function(doc) {
        var newAmount = parseFloat(doc.data().accountsRefs[num].balance) + sign * amount;

        var accounts = doc.data().accountsRefs;
        accounts[num].balance = newAmount;
        
        usersRef.update({
            accountsRefs: accounts
        })
    })
}

function checkCourseOnClick() {
    var num = parseFloat(document.getElementById("transfer_money_acc_num").value) - 1;
    var newCurrency = document.getElementById("moneyType").value;
    var newId = currencyToId(newCurrency);
    var oldId;

    usersRef.get().then(function(doc) {
        var oldCurrency = doc.data().accountsRefs[num].type;
        oldId = currencyToId(oldCurrency);
    })

    db.collection('api-info').doc('currencies').get().then(function(doc) {
        var exch = doc.data().currencies;
        document.getElementById("coursePlaceHolder").innerHTML = exch[oldId * currencies + newId].toFixed(4);
    })
}

function changeMoney() {
    var num = parseFloat(document.getElementById("transfer_money_acc_num").value) - 1;
    var newCurrency = document.getElementById("moneyType").value;
    var course = parseFloat(document.getElementById("coursePlaceHolder").innerHTML);

    usersRef.get().then(function(doc) {
        var accounts = doc.data().accountsRefs;
        accounts[num].balance = accounts[num].balance * course;
        accounts[num].type = newCurrency;
        
        usersRef.update({
            accountsRefs: accounts
        })
    })

    // reset course placeholder
    document.getElementById("coursePlaceHolder").innerHTML = "0.0000";
}

function moneyTypeChange() {
    // reset course placeholder
    document.getElementById("coursePlaceHolder").innerHTML = "0.0000";
}

function sliderValueChange(value) {
    document.getElementById("sliderValue").innerHTML = value;
}

function saveBotChanges() {
    usersRef.update({
        botEnabled: document.getElementById("enabledCheck").checked,
        waitForApproval: document.getElementById("waitApprovalCheck").checked,
        checkInterval: document.getElementById("botCheckRate").value
    })
}

const db = firebase.firestore();
let usersRef;
let unsubscribe;
let currentUid;

auth.onAuthStateChanged(user => {
    
    if (user) {
        usersRef = db.collection('users').doc(user.uid);
        currentUid = user.uid;

        // check if db entry exists, create if not
        usersRef.get().then(function(doc) {
            if (doc.exists) {
                console.log("Account exists with data:", doc.data());
            } else {
                // create user
                console.log("User not registered! Creating user.");
                var username = user.displayName;
                    if (username == null) {
                        username = user.email.split("@", 1);
                    }

                    var docData = {
                        uid: user.uid,
                        name: username,
                        email: user.email,
                        accounts: 1,
                        accountsRefs: [
                            {
                                type: "RON",
                                balance: 0.0000
                            }
                        ],
                        botEnabled: true,
                        waitForApproval: false,
                        checkInterval: 2,
                        lastCheck: Date.now()
                    };
                    usersRef.set(docData).then(function() {
                        console.log("User successfully added!");
                    });
            }
        }).catch(function(error) {
            console.log("Error getting document:", error);
        });

        // accouns real time management
        usersRef
            .onSnapshot( {
                includeMetadataChanges: true
            }, function(doc) {

                // print number of open accounts
                var accounts = doc.data().accounts;
                document.getElementById("openAccountsLabel").innerHTML = "Open accounts: " + accounts;
                for (var i = 0; i < accounts; ++i) {
                    var acc = doc.data().accountsRefs[i];
                    document.getElementById("acc" + i).innerHTML = (i + 1) + ". " + acc.type + " " + (Math.round(acc.balance * 10000) / 10000);
                }

                // update settings
                document.getElementById("enabledCheck").checked = doc.data().botEnabled;
                document.getElementById("waitApprovalCheck").checked = doc.data().waitForApproval;
                document.getElementById("botCheckRate").value = doc.data().checkInterval;
                document.getElementById("sliderValue").innerHTML = doc.data().checkInterval;

            });

    } else {
        unsubscribe && unsubscribe()
    }
    
});

function topFunction() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }