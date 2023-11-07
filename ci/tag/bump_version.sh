#!/usr/bin/env bash

SOURCE_DIR=$(cd $(dirname ${BASH_SOURCE:-$0}) && pwd)

cd ${SOURCE_DIR}

# set -eu

current_version=$(git tag -l --sort=v:refname | tail -n1)
current_version_number=$(echo ${current_version} | sed "s/^v//")
if [ -z "${current_version_number}" ] ; then
	current_version_number="0.0.0"
fi

new_version_number=$(. increment_version.sh -p ${current_version_number})
new_version="v${new_version_number}"

git tag -a ${new_version} -m ${new_version}
jq --arg version ${new_version_number} '. += {"version": $version}' ${SOURCE_DIR}/../../package.json
tmp=$(mktemp)
jq --arg version ${new_version_number} \
	'. += {"version": $version}' \
	${SOURCE_DIR}/../../package.json > "$tmp" \
	&& mv "$tmp" ${SOURCE_DIR}/../../package.json
