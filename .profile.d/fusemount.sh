#!/bin/bash
##########
# Colors - Lets have some fun ##
##########
Green='\e[0;32m'
Red='\e[0;31m'
Yellow='\e[0;33m'
Cyan='\e[0;36m'
no_color='\e[0m' # No Color
beer='\xF0\x9f\x8d\xba'
delivery='\xF0\x9F\x9A\x9A'
beers='\xF0\x9F\x8D\xBB'
eyes='\xF0\x9F\x91\x80'
cloud='\xE2\x98\x81'
litter='\xF0\x9F\x9A\xAE'
fail='\xE2\x9B\x94'
harpoons='\xE2\x87\x8C'
tools='\xE2\x9A\x92'
present='\xF0\x9F\x8E\x81'
#############
echo ""
INSTALLPKG=uploads
if [ -n "${SSHFS_HOST+set}" ]; then
  echo -e "${delivery}${Yellow}  Detected SSHFS Environment Variables. Initiating relocation of wp-content to remote storage ..."
  echo -e "${delivery}${Yellow}  Reading SSHFS mount environment variables ..."
  if [ -f "/home/vcap/app/.profile.d/id_rsa" ]; then
    echo -e "${beer}${Cyan}    Existing Identity file detected."
  else
    if [ -n "${SSHFS_PRIV+set}" ]; then
      echo -e "${tools}${Yellow}    Persisting Private Key Env Var to file id_rsa ..."
      echo "$SSHFS_PRIV" > "/home/vcap/app/.profile.d/id_rsa"
    else
      echo -e "${fail}${Red}    User-provided Env Var SSHFS_PRIV not set!"
    fi
  fi
  echo -e "${delivery}${Yellow}    Securing IdentityFile from Man-In-The-Middle Attacks ..."
  chmod 600 /home/vcap/app/.profile.d/id_rsa
  echo -e "${delivery}${Yellow}    Adding the key to the ssh-agent ..."
  eval $(ssh-agent)
  ssh-add /home/vcap/app/.profile.d/id_rsa 2>/dev/null
  echo -e "${delivery}${Yellow}    Generating known_hosts file ..."
  SSHKey=$(ssh-keyscan -t RSA -H ${SSHFS_HOST} 2> /dev/null)
  echo $SSHKey > "/home/vcap/app/.profile.d/known_hosts"
  echo -e "${delivery}${Yellow}    Creating mount location ..."
  mkdir -p /home/vcap/misc
  echo -e "${delivery}${Yellow}  Initiating SSHFS mount ..."
  if [ -n "${SSHFS_USER+set}" ] && [ -n "${SSHFS_DIR+set}" ]; then
    # Reference: http://manpages.ubuntu.com/manpages/karmic/en/man1/sshfs.1.html
    # SSHFS Tuning Reference: http://www.admin-magazine.com/HPC/Articles/Sharing-Data-with-SSHFS
    sshfs ${SSHFS_USER}@${SSHFS_HOST}:${SSHFS_DIR} /home/vcap/misc -o IdentityFile=/home/vcap/app/.profile.d/id_rsa,StrictHostKeyChecking=yes,UserKnownHostsFile=/home/vcap/app/.profile.d/known_hosts,idmap=user,compression=yes,cache=yes,kernel_cache,large_read,Ciphers=arcfour,cache_timeout=115200,attr_timeout=115200
  else
    echo -e "${fail}${Red}    SSHFS Mount failed!"
    echo -e "${fail}${Red}    User-provided Env Var SSHFS_USER AND/OR SSHFS_DIR not set!"
  fi
  if [ -n "${SSHFS_NAMESPACE+set}" ]; then
    echo -e "${cloud}${Yellow}  Current deployed application SSHFS Unique Namespace is ${Cyan}${SSHFS_NAMESPACE}"
    echo -e "${delivery}${Yellow}  Creating Domain Namespace within mounted location ..."
    mkdir -p /home/vcap/misc/${SSHFS_NAMESPACE}
    ls -al /home/vcap/misc
    echo -e "${delivery}${Yellow}  Creating wp-content folder within mounted Domain Namespace ..."
    mkdir -p /home/vcap/misc/${SSHFS_NAMESPACE}/wp-content
    # Note:  Rename of existing assembled wp-content folder must always precede the Symlink creation
    echo -e "${delivery}${Yellow}  Temporarily renaming wp-content folder ..."
    mv /home/vcap/app/htdocs/wp-content /home/vcap/app/htdocs/mirage
    echo -e "${delivery}${Yellow}  Creating Symlink between Wordpress wp-content folder and mounted Domain Namespace location ..."
    ln -s /home/vcap/misc/${SSHFS_NAMESPACE}/wp-content /home/vcap/app/htdocs/wp-content
    # Comment:  cp is too slow, even with 180 sec extended health check
    # cp -R /home/vcap/app/htdocs/${INSTALLPKG}/mirage/. /home/vcap/app/htdocs/wp-content
    # Comment:  scp was too slow, even with 180 sec extended health check
    # scp -r /home/vcap/app/htdocs/${INSTALLPKG}/mirage/. /home/vcap/app/htdocs/wp-content
    # Comment:  Tar over ssh is also too slow for the health check timeout, but it is the fastest of the 3 approaches.
    # To overcome the health check timeout limitation, we modify our deploy script to push the application as a worker (e.g. --no-route )
    # An app pushed as a worker is not subject to the health check timeout.
    # In theory, now that we are using a SSHFS file storage, installation via website should persist.  This should also enable multiple cf instances
    echo -e "${eyes}${Cyan}  Inspecting mounted Domain Namespace for existing files ..."
    if [ -f "/home/vcap/misc/${SSHFS_NAMESPACE}/wp-content/index.php" ]; then
      echo -e "${beer}${Cyan}    Existing index.php file detected.  Skipping transfer of wp-content folder."
    else
      echo -e "${harpoons}${Yellow}    Moving previous wp-content folder content onto SSHFS mount (Overwrite enabled).  Estimated time: > 3 mins ..."
      ls -al /home/vcap/app/htdocs
      tar -C /home/vcap/app/htdocs/mirage -jcf - ./ | ssh -i /home/vcap/app/.profile.d/id_rsa -o UserKnownHostsFile=/home/vcap/app/.profile.d/known_hosts ${SSHFS_USER}@${SSHFS_HOST} "tar -C/home/paramount/${SSHFS_NAMESPACE}/wp-content -ojxf -"
      echo -e "${eyes}${Cyan}  Changing ownership of files folder to match apache web user [vcap] ..."
      chown -R vcap /home/vcap/misc/${SSHFS_NAMESPACE}/wp-content
      chmod -R 0700 /home/vcap/misc/${SSHFS_NAMESPACE}/wp-content
    fi
    echo -e "${litter}${Yellow}  Removing legacy wp-content folder"
    rm -rf /home/vcap/app/htdocs/wp-content/mirage
  else
    echo -e "${fail}${Red}    Symlink creation failed!"
    echo -e "${fail}${Red}    Env Var SSHFS_NAMESPACE not set!"
  fi
else
  echo -e "${delivery}${Yellow}  No SSHFS Environment Variables detected. Proceeding with local ephemeral wp-content folder."
fi

# Reference Commands
# How to generate a key-pair with no passphrase in a single command
# ssh-keygen -b 2048 -t rsa -f /home/vcap/app/.profile.d/sshkey -q -N ""
# Command below uses debug options which causes process to run in foreground ... good for debugging but not useful for running with cf apps because it will hold the process and block the app from starting.

# sshfs root@134.168.17.44:/home/paramount /home/vcap/misc -o IdentityFile=/home/vcap/app/.profile.d/id_rsa,StrictHostKeyChecking=yes,UserKnownHostsFile=/home/vcap/app/.profile.d/known_hosts,idmap=user,compression=no,sshfs_debug,debug
