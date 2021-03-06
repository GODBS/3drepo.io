"use strict";

const gulp = require("gulp");
const eslint = require("gulp-eslint");
const env = require("gulp-env");
const mocha = require("gulp-mocha");
const path = require("path");
const abs = path.resolve;

gulp.task("test:integrated", function(){

    const envs = env.set({
        NODE_ENV: "test",
        NODE_CONFIG_DIR: "../config/"
    });

    gulp.src(abs("./test/integrated/**/*.js"))
        .pipe(envs)
        .pipe(mocha({
            reporter: "spec",
            timeout: 10000
        }))
        .once("error", (error) => {
            console.log(error);
            process.exit(1);
        })
        .once("end", () => {
            process.exit();
        });

});

gulp.task("test:unit", function(){

    env.set({
        NODE_ENV: "test",
        NODE_CONFIG_DIR: "../config/"
    });

    gulp.src(abs("./test/unit/**/*.js"), {read: false})
        .pipe(mocha({reporter: "spec"}))
        .once("error", (error) => {
            console.log(error);
            process.exit(1);
        })
        .once("end", () => {
            process.exit();
        });

});

gulp.task("test:lint", function(){
    return gulp.src(["./**/*.js","!node_modules/**", "!gulpfile.js", "!doc/**" ])
        // eslint() attaches the lint output to the "eslint" property 
        // of the file object so it can be used by other modules. 
        .pipe(eslint())
        // eslint.format() outputs the lint results to the console.  
        .pipe(eslint.format());
});

gulp.task("test:lint-fix", function(){
    return gulp.src(["./**/*.js","!node_modules/**", "!gulpfile.js", "!doc/**" ])
        // eslint() attaches the lint output to the "eslint" property 
        // of the file object so it can be used by other modules. 
        .pipe(eslint({fix:true}))
        // eslint.format() outputs the lint results to the console.  
        .pipe(eslint.format());
});

gulp.task("test:integrated-one", function() {
    if (process.argv.length === 5) {
            
        const envs = env.set({
            NODE_ENV: "test",
            NODE_CONFIG_DIR: "../config/"
        });

        const intPath = abs("./test/integrated/" + process.argv[4]);
        console.log("processing " + intPath);

        gulp.src(intPath)
            .pipe(envs)
            .pipe(mocha({
                reporter: "spec",
                timeout: 10000
            }))
            .once("error", (error) => {
                console.log(error);
                process.exit(1);
            })
            .once("end", () => {
                process.exit();
            });
    } else {
        console.log("Must provide one argument; the file name of the intergrated test");
    }
});


gulp.task("test", ["test:unit", "test:integrated"]);
