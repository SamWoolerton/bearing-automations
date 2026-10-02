# Overview: Bearing Automations

This repo is for internal time-saving tools for Bearing, a dev agency.
Correctness is crucial! We're dealing with important data and we can't get this wrong.

# Code style guidelines

Refactoring is good. "Twice is too many", so constants/functions/components that appear multiple times should be refactored out to reduce duplication and make the codebase higher-quality.

Use the utilities from `@bearing-agency/utilities` wherever possible.

Always make changes in bite-sized chunks so I can review each step as we go.

I have the tests running in the background, you don't need to run them - I'll tell you if they fail.
Let the snapshots auto-fill, no need to provide those values yourself.

Don't write comments, unless they're critically necessary. In 99% of cases they're not so don't add anything as it's clear from the code already!
