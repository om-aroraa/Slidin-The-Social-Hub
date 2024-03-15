const express = require("express");
const path = require("path");
const mysql = require("mysql2");
const fileUpload = require("express-fileupload");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const app = express();
const port = 3000;

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "slidin",
});

app.use(express.static(path.join(__dirname, "public")));
app.use(
  fileUpload({
    createParentPath: true,
  })
);
app.use(cookieParser());
app.use(
  session({
    secret: "saddjiasofjidjsfcagcrsdfngcawyefngdm",
    resave: false,
    saveUninitialized: true,
  })
);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "HTML"));

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

app.get("/", (req, res) => {
  res.render("welcome.ejs");
});

app.get("/login", (req, res) => {
  return res.render("login", { message: "" });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    (err, results) => {
      if (err) throw err;
      if (results.length === 0)
        return res.render("login", { message: "Username does not exist!" });
      if (results[0].password !== password)
        return res.render("login", { message: "Password is incorrect!" });
      res.cookie("user", username, { maxAge: 3600000 });
      res.cookie("userimg", results[0].imgpath, { maxAge: 3600000 });
      res.redirect("/profile");
    }
  );
});

app.get("/signup", (req, res) => {
  res.render("signup.ejs", { message: false });
});

app.post("/signup", (req, res) => {
  const { name, username, email, password, confirmPassword, gender } = req.body;
  let profile_pic;
  try {
    profile_pic = req.files.profilePicture || false;
  } catch (e) {
    profile_pic = false;
  }
  let imgpath;
  if (!profile_pic) {
    imgpath = "/profilepics/default.png";
  } else {
    imgpath = "/profilepics/" + `${username}/` + profile_pic.name;
  }
  if (password !== confirmPassword)
    return res.render("signup", { message: "Passwords do not match!" });
  db.query(
    "select * from users where username = ?",
    [username],
    (err, result) => {
      if (err) throw err;
      if (result.length > 0)
        return res.render("signup", { message: "Username already exists!" });
      db.query(
        "select * from users where email = ?",
        [email],
        (err, result) => {
          if (err) throw err;
          if (result.length > 0)
            return res.render("signup", { message: "Email already exists!" });
          // Insert user into database
          db.query(
            "insert into users (name, username, email, password, gender, imgpath) values (?,?,?,?,?,?)",
            [name, username, email, password, gender, imgpath],
            (err, result) => {
              if (err) throw err;
              if (profile_pic) {
                profile_pic.mv(
                  `${__dirname}/public/profilepics/${username}/${profile_pic.name}`,
                  function (err) {
                    if (err) return res.status(500).send(err);
                    res.cookie("user", username, { maxAge: 3600000 });
                    res.cookie("userimg", imgpath, { maxAge: 3600000 });
                    res.redirect("/profile");
                  }
                );
              } else {
                res.cookie("user", username, { maxAge: 3600000 });
                res.cookie("user", username, { maxAge: 3600000 });
                res.redirect("/profile");
              }
            }
          );
        }
      );
    }
  );
});

app.get("/profile", (req, res) => {
  let username = req.cookies.user;
  if (!username) return res.redirect("/login");
  db.query(
    "SELECT imgpath, name FROM users WHERE username = ?",
    [username],
    (err, results) => {
      if (err) throw err;
      if (results.length === 0) return res.send("No user with that username");
      let imgpath = results[0].imgpath;
      let name = results[0].name;
      if (!imgpath) imgpath = "/profilepics/default.png";
      db.query(
        "SELECT COUNT(*) AS postCount FROM createposts WHERE username = ?",
        [username],
        (err, postResults) => {
          if (err) throw err;
          let postCount = postResults[0].postCount;
      db.query(
        "SELECT * FROM friends WHERE username = ?",
        [username],
        (err, results) => {
          if (err) throw err;
          let accepted;
          if (results.length === 0) accepted = "";
          else accepted = results[0].accepted.split(",");
          if (accepted[0] === "") accepted = [];
          db.query(
            "SELECT * FROM createposts WHERE username = ?", [username],
            (err, results) => {
              if (err) throw err;
              let posts = results;
              let today = [];
              let archive = [];
              let current = new Date().getTime();
              new Promise((resolve, reject) => {
                posts.forEach((post) => {
                  // Check if post is older than 24 hours
                  if (current - post.timestamp > 86400000) {
                    archive.push(post);
                  } else {
                    today.push(post);
                  }
                });
                resolve();
              }).then(() => {
                res.render("profile", {
                  userpath: decodeURIComponent(req.cookies.userimg),
                  path: imgpath,
                  username: username,
                  name: name,
                  results: false,
                  searched: false,
                  value: false,
                  totalFriends: accepted.length,
                  posts: today,
                  archives: archive,
                  postCount: postCount
                });
              });
            });
          });
        }
      );
    }
  );
});

app.post("/profile", (req, res) => {
  let username = req.cookies.user;
  if (!username) return res.redirect("/");

  const { value } = req.body;
  let imgpath = decodeURIComponent(req.cookies.userimg);
  if (!imgpath) imgpath = "/profilepics/default.png";

  if (value === "") {
    // Handle the case where the search value is empty
    return res.redirect("/profile");
  }

  // Fetch users matching the search value
  db.query(
    "SELECT username, imgpath FROM users WHERE username LIKE ?",
    [value + "%"],
    (err, Searchresults) => {
      if (err) throw err;
      db.query(
        "SELECT COUNT(*) AS postCount FROM createposts WHERE username = ?",
        [username],
        (err, postResults) => {
          if (err) throw err;
          let postCount = postResults[0].postCount;
      // Fetch friend data
      db.query(
        "SELECT accepted FROM friends WHERE username = ?",
        [username],
        (err, friendResults) => {
          if (err) throw err;
          let accepted;
          if (friendResults.length === 0) accepted = "";
          else accepted = friendResults[0].accepted.split(",");
          if (accepted[0] === "") accepted = [];

          let currentUser = req.cookies.user;

          // Fetch posts of current user
          db.query(
            "SELECT * FROM createposts WHERE username = ?",
            [currentUser],
            (err, results) => {
              if (err) throw err;
              let posts = results;
              let today = [];
              let archive = [];
              let current = new Date().getTime();
              new Promise((resolve, reject) => {
                posts.forEach((post) => {
                  // Check if post is older than 24 hours
                  if (current - post.timestamp > 86400000) {
                    archive.push(post);
                  } else {
                    today.push(post);
                  }
                });
                resolve();
              }).then(() => {
                res.render("profile", {
                  userpath: decodeURIComponent(req.cookies.userimg),
                  path: imgpath,
                  username: username,
                  results: Searchresults,
                  searched: true,
                  value: value,
                  totalFriends: accepted.length,
                  posts: today,
                  archives: archive,
                  postCount: postCount
                });
              });
            });
          });
        }
      );
    }
  );
});

app.get("/profile/:username", (req, res) => {
  let username = req.params.username;
  if (!username) return res.redirect("/");
  db.query(
    "SELECT imgpath, name FROM users WHERE username = ?",
    [username],
    (err, results) => {
      if (err) throw err;
      if (results.length === 0) return res.send("No user with that username");
      let imgpath = results[0].imgpath;
      let name = results[0].name;
      if (!imgpath) imgpath = "/profilepics/default.png";
      
      // Query to count the number of posts for the user
      db.query(
        "SELECT COUNT(*) AS postCount FROM createposts WHERE username = ?",
        [username],
        (err, postResults) => {
          if (err) throw err;
          let postCount = postResults[0].postCount; // Extract the post count from the query result
          
          db.query(
            "SELECT * FROM friends WHERE username = ?",
            [username],
            (err, results) => {
              if (err) throw err;
              let accepted = "";
              if (results.length !== 0) accepted = results[0].accepted.split(",");
              if (accepted[0] === "") accepted = [];
              
              db.query(
                "SELECT * FROM createposts WHERE username = ?", [username],
                (err, results) => {
                  if (err) throw err;
                  let result;
                  let posts = results;
                  let today = [];
                  let current = new Date().getTime();
                  new Promise((resolve, reject) => {
                    posts.forEach((post) => {
                      // Check if post is older than 24 hours
                      if (current - post.timestamp < 86400000) {
                        today.push(post);
                      }
                    });
                    resolve();
                  }).then(() => {
                    res.render("viewprofile", {
                      userpath: decodeURIComponent(req.cookies.userimg),
                      path: imgpath,
                      username: username,
                      name: name,
                      results: false,
                      searched: false,
                      value: false,
                      totalFriends: accepted.length,
                      posts: today,
                      archives: [],
                      postCount: postCount // Pass the postCount variable to the template
                    });
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

app.post("/profile/:username", (req, res) => {
  let username = req.cookies.user;
  if (!username) return res.redirect("/");

  const { value } = req.body;
  let imgpath = decodeURIComponent(req.cookies.userimg);
  if (!imgpath) imgpath = "/profilepics/default.png";

  if (value === "") {
    // Handle the case where the search value is empty
    return res.redirect("/viewprofile/" + username);
  }

  // Fetch users matching the search value
  db.query(
    "SELECT username, imgpath FROM users WHERE username LIKE ?",
    [value + "%"],
    (err, Searchresults) => {
      if (err) throw err;
      db.query(
        "SELECT COUNT(*) AS postCount FROM createposts WHERE username = ?",
        [username],
        (err, postResults) => {
          if (err) throw err;
          let postCount = postResults[0].postCount;
      // Fetch friend data
      db.query(
        "SELECT accepted FROM friends WHERE username = ?",
        [username],
        (err, friendResults) => {
          if (err) throw err;
          let accepted;
          if (friendResults.length === 0) accepted = "";
          else accepted = friendResults[0].accepted.split(",");
          if (accepted[0] === "") accepted = [];

          let currentUser = req.cookies.user;

          // Fetch posts of current user
          db.query(
            "SELECT * FROM createposts WHERE username = ?",
            [currentUser],
            (err, results) => {
              if (err) throw err;
              let posts = results;
              let today = [];
              let archive = [];
              let current = new Date().getTime();
              new Promise((resolve, reject) => {
                posts.forEach((post) => {
                  // Check if post is older than 24 hours
                  if (current - post.timestamp > 86400000) {
                    archive.push(post);
                  } else {
                    today.push(post);
                  }
                });
                resolve();
              }).then(() => {
                res.render("viewprofile", {
                  userpath: decodeURIComponent(req.cookies.userimg),
                  path: imgpath,
                  username: username,
                  results: Searchresults,
                  searched: true,
                  value: value,
                  totalFriends: accepted.length,
                  posts: today,
                  archives: archive,
                  postCount: postCount
                });
              });
            });
          });
        }
      );
    }
  );
});

app.get("/createposts", (req, res) => {
  let username = req.cookies.user;
  if (!username) return res.redirect("/");
  db.query(
    "SELECT imgpath FROM users WHERE username = ?",
    [username],
    (err, results) => {
      if (err) throw err;
      if (results.length === 0) return res.send("No user with that username");
      let imgpath = results[0].imgpath;
      if (!imgpath) imgpath = "/profilepics/default.png";
      res.render("createposts", {
        path: imgpath,
        username: username,
        value: false,
        results: false,
        searched: false,
      });
    }
  );
});
  
app.post("/createposts", (req, res) => {
  let username = req.cookies.user;
  if (!username) return res.redirect("/");
  let caption = req.body.caption;
  let posts_path = `/profilepics/${username}`;
  let files = req.files;
  let post = files.post;
  posts_path = posts_path + "/" + post.name;
  let timestamp = new Date().getTime();
  db.query(
    "INSERT INTO createposts (username, postpath, postcaption, timestamp) VALUES (?, ?, ?, ?)",
    [username, posts_path, caption, timestamp],
    (err, results) => {
      if (err) throw err;
      if (post) {
        post.mv(
          `${__dirname}/public/profilepics/${username}/${post.name}`,
          function () {
            if (err) return res.status(500).send(err);;
            res.redirect("/profile");
          }
        );
      } else {
        res.sendStatus(404);
      }
    }
  );
});

app.post("/friend/:username", (req, res) => {
  let username = req.cookies.user;
  if (!username) return res.redirect("/");
  let friend = req.params.username;
  db.query(
    "SELECT * FROM friends WHERE username = ?",
    [username],
    (err, results) => {
      if (err) throw err;
      if (results.length === 0) {
        db.query(
          "INSERT INTO friends (username, sent, recieved, accepted) VALUES (?, ?, ?, ?)",
          [username, friend, "", ""],
          (err, results) => {
            if (err) throw err;
            //want to redirect to the profile of the other user
            res.redirect("/profile/" + friend);
          }
        );
      } else {
        let requests = results[0].sent;
        let arr = requests.split(",");
        if (arr.includes(friend)) return res.redirect("/profile");
        if (requests === "") {
          requests = friend;
        } else {
          requests += "," + friend;
        }
        db.query(
          "UPDATE friends SET sent = ? WHERE username = ?",
          [requests, username],
          (err, results) => {
            if (err) throw err;
             db.query(
              "INSERT INTO notifications (recipient, message) VALUES (?, ?)",
              [friend, "You received a friend request from " + username],
              (err, results) => {
                if (err) throw err;
                res.redirect("/profile/" + friend);
              }
            );
            res.redirect("/profile");
          }
        );
      }
    }
  );
});

app.get("/friends", (req, res) => {
  let username = req.cookies.user;
  if (!username) return res.redirect("/");
  db.query(
    "SELECT imgpath FROM users WHERE username = ?",
    [username],
    (err, results) => {
      if (err) throw err;
      if (results.length === 0) return res.send("No user with that username");
      let imgpath = results[0].imgpath;
      if (!imgpath) imgpath = "/profilepics/default.png";
      db.query(
        "SELECT * FROM friends WHERE username = ?",
        [username],
        async (err, results) => {
          if (err) throw err;
          let accepted = results[0].accepted;
          let received = results[0].received; // Fetch received requests
          accepted = accepted.split(",");
          received = received.split(","); // Split received requests
          let acceptedFriends = await new Promise((resolve, reject) => {
            db.query(
              "SELECT username, imgpath FROM users WHERE username IN (?)",
              [accepted],
              (err, results) => {
                if (err) reject(err);
                resolve(results);
              }
            );
          });
          let receivedRequests = await new Promise((resolve, reject) => {
            db.query(
              "SELECT username FROM users WHERE username IN (?)",
              [received],
              (err, results) => {
                if (err) reject(err);
                resolve(results);
              }
            );
          });
          res.render("friends", {
            path: imgpath,
            username: username,
            acceptedFriends: acceptedFriends,
            receivedRequests: receivedRequests, // Pass received requests to the template
          });
        }
      );
    }
  );
});

app.get("/notifications", (req, res) => {
  let username = req.cookies.user;
  if (!username) return res.redirect("/");

  db.query(
    "SELECT * FROM notifications WHERE recipient = ?",
    [username],
    (err, results) => {
      if (err) throw err;
      res.render("notifications", { notifications: results });
    }
  );
});

app.get("/logout", (req, res) => {
  res.clearCookie("user");
  res.clearCookie("userimg");
  res.redirect("/");
});
