FROM frappe/erpnext:version-15

USER root
# Ensure proper permissions exist for the new app
RUN chown -R frappe:frappe /home/frappe/frappe-bench/env /home/frappe/frappe-bench/apps /home/frappe/frappe-bench/sites

USER frappe
RUN git clone --depth 1 https://github.com/frappe/lms.git /home/frappe/frappe-bench/apps/lms && \
    cd /home/frappe/frappe-bench && \
    env/bin/pip install -e apps/lms && \
    echo "frappe" > sites/apps.txt && \
    echo "erpnext" >> sites/apps.txt && \
    echo "lms" >> sites/apps.txt
