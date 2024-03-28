import {LintError} from "./LintError.js";
import {Run} from "./Run.js";
import {Repository} from "./Repository.js";
import {GithubRepository} from "./GithubRepository.js";
import {TestResult} from "./TestResult.js"

LintError.belongsTo(Repository, {
    foreignKey: "repository_id"
});
Repository.hasMany(LintError, {
    foreignKey: "repository_id"
});

Repository.belongsTo(Run, {
    foreignKey: "run_id"
});
Run.hasMany(Repository, {
    foreignKey: "run_id"
});

TestResult.belongsTo(LintError, {
    foreignKey: "lint_error_id"
});

LintError.hasMany(TestResult, {
    foreignKey: "lint_error_id"
})
