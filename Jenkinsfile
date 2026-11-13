pipeline {
    agent any
    triggers {
        //pollSCM('* * * 1 *')
        githubPush()
    }
    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
    }
    stages {
        stage('Install') {
            steps {
                bat 'node --version'
                bat 'npm ci'
                bat 'npx playwright install chromium'
            }
        }
        stage('Smoke') {
            steps {
                bat 'npm run test:smoke'
            }
        }
        stage('Regression') {
            steps {
                catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
                    bat 'npm run test:regression'
                }
            }
        }
    }
    post {
        always {
            archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
        }
    }
}